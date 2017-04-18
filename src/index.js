const path = require('path')
const Parse = require('parse/node')
const fs = require('fs-promise')
const secrets = require('./secrets')
const studyJSON = require('./get-metadata')
const getFiles = require('./get-files')
const hash = require('./hash')
const makeTemplate = require('./study-template')
const cfg = require('../src/cfg')
const lifecycle = require('./lifecycle')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')
const info = require('./utils/output/info')

Parse.initialize(secrets.PARSE_APP_ID)

const Study = Parse.Object.extend('Study')
const Version = Parse.Object.extend('Version')
const Team = Parse.Object.extend('Team')
const File = Parse.Object.extend('File')
const Invite = Parse.Object.extend('Invite')

const IS_WIN = process.platform.startsWith('win')
const SEP = IS_WIN ? '\\' : '/'

module.exports = class Kyso {
  constructor({ url, token, debug = false, dir = process.cwd() }) {
    Parse.serverURL = url
    this._token = token
    this.dir = dir
    this.debug = debug
    _debug(this.debug, `Kyso object.`)
    _debug(this.debug, `dir: ${dir}`)
    _debug(this.debug, `url: ${url}`)
    _debug(this.debug, `token: ${token}`)

    const { hasStudyJson, studyConfig } = studyJSON.read(this.dir)
    this.hasStudyJson = hasStudyJson
    // lets copy the pkg so we can mutate it
    this.pkg = hasStudyJson ? Object.assign(studyConfig) : null
  }

  async createStudy(name) {
    let teamName = null
    let studyName = name
    let author = cfg.read().nickname

    if (name.includes('/')) {
      teamName = name.split('/')[0]
      studyName = name.split('/')[1]
    }

    if (this.hasStudyJson) {
      console.log('A study.json already exists.')
      return false
    }

    const query = new Parse.Query(Study)
    query.equalTo('name', studyName)
    const count = await query.count({ sessionToken: this._token })
    if (count !== 0) {
      const error = new Error(`You already have a study called ${studyName}`)
      error.userError = true
      throw error
    }

    if (teamName && teamName !== cfg.read().nickname) {
      // it might be a team lets check
      const teamQuery = new Parse.Query(Team)
      _debug(this.debug, teamName)
      teamQuery.equalTo('name', teamName)
      const teams = await teamQuery.find({ sessionToken: this._token })
      if (teams.length === 0) {
        const error = new Error(`You don't have access to a team called "${teamName}".`)
        error.userError = true
        throw error
      } else {
        const team = teams[0]
        author = team.get('name')
      }
    }

    const study = new Study()
    study.set('name', studyName)
    study.set('author', author)

    await study.save(null, { sessionToken: this._token })

    const template = await makeTemplate({
      name: studyName,
      author
    })

    await fs.writeFile(path.join(this.dir, 'study.json'), template)
    return true
  }

  async lsStudies() {
    const query = new Parse.Query(Study)
    const studies = await query.find({ sessionToken: this._token })
    return studies
  }

  async rmStudy(study) {
    return study.destroy({ sessionToken: this._token })
  }


  async createTeam(name) {
    const team = new Team()
    team.set('name', name)
    _debug(this.debug, `Saving team.`)
    return team.save(null, { sessionToken: this._token })
  }

  async lsTeams() {
    const query = new Parse.Query(Team)
    const teams = await query.find({ sessionToken: this._token })
    return teams
  }

  async rmTeam(team) {
    return team.destroy({ sessionToken: this._token })
  }


  async createInvite(targetEmail, teamName) {
    const invite = new Invite()
    invite.set('targetEmail', targetEmail)
    invite.set('targetTeam', teamName)
    return invite.save(null, { sessionToken: this._token })
  }

  async lsInvites() {
    const query = new Parse.Query(Invite)
    const invites = await query.find({ sessionToken: this._token })
    await Promise.all(
      invites.map((invite) => invite.get('team').fetch({ sessionToken: this._token }))
    )
    return invites
  }

  async rmInvite(invite) {
    return invite.destroy({ sessionToken: this._token })
  }

  async addTag(tag) {
    if (!this.hasStudyJson) {
      const error = new Error('No study.json, cannot list tags.')
      error.userError = true
      throw error
    }

    const _tags = this.pkg.tags || []
    if (_tags.includes(tag)) {
      const error = new Error('Tag already exists.')
      error.userError = true
      throw error
    }

    _tags.push(tag)
    const tags = _tags
      .filter((val, index, array) => array.indexOf(val) === index)
    studyJSON.merge(this.dir, { tags })
    return true
  }

  async lsTags() {
    if (!this.hasStudyJson) {
      const error = new Error('No study.json, cannot list tags.')
      error.userError = true
      throw error
    }

    return this.pkg.tags || []
  }

  async rmTag(tag) {
    if (!this.hasStudyJson) {
      const error = new Error('No study.json, cannot list tags.')
      error.userError = true
      throw error
    }

    const _tags = this.pkg.tags || []
    if (!_tags.includes(tag)) {
      const error = new Error('Tag doesn\'t exists.')
      error.userError = true
      throw error
    }

    const tags = _tags
      .filter((val, index, array) => array.indexOf(val) === index)
      .filter(val => val !== tag)

    await studyJSON.merge(this.dir, { tags })
    return true
  }

  async run(cmd, cmdArgs) {
    this.pkg.scripts = this.pkg.scripts || {}

    if (!this.pkg.scripts[cmd]) {
      const error = new Error(`Command "${cmd}" not found in scripts`)
      error.userError = true
      throw error
    }

    this.pkg.scripts[cmd] = this.pkg.scripts[cmd] + cmdArgs
    return lifecycle(this.pkg, cmd, this.dir, true)

    /*
    DEV:
      to run a hook called prepush just run like so:
      `return lifecycle(this.pkg, 'prepush', this.dir, true)`
    */
  }

  async createVersion(message) {
    if (!this.hasStudyJson) {
      const error = new Error(`No study.json! Run 'kyso create <study-name> to make a study.'`)
      error.userError = true
      throw error
    }

    const fileList = await getFiles(this.dir, this.pkg, { debug: this.debug })
    const hashes = await hash(fileList)
    const _files = hashes

    const files = await Promise.all(Array.prototype.concat.apply([],
      await Promise.all(Array.from(_files).map(async ([sha, { data, names }]) => {
        const statFn = fs.stat
        return names.map(async name => {
          let mode
          const getMode = async () => {
            const st = await statFn(name)
            return st.mode
          }

          if (this._static) {
            if (toRelative(name, this.dir) === 'package.json') {
              mode = 33261
            } else {
              mode = await getMode()
              name = this.pathInsideContent(name) // eslint-disable-line
            }
          } else {
            mode = await getMode()
          }

          return {
            sha,
            size: data.length,
            file: toRelative(name, this.dir),
            mode,
            data: data.toString('base64')
          }
        })
      }))
    ))

    const version = new Version()
    version.set('message', message)
    const relation = version.relation('files')
    const fileMap = {}

    await Promise.all(Array.from(files).map(async ({ sha, size, file, data }) => {
      const fileQuery = new Parse.Query(File)
      fileQuery.equalTo('sha', sha)
      const existingFiles = await fileQuery.find({ sessionToken: this._token })

      let fileObj
      if (existingFiles.length > 0) {
        fileObj = existingFiles[0]
      } else {
        const parseFile = new Parse.File(sha, { base64: data })
        await parseFile.save({ sessionToken: this._token })
        fileObj = new File()

        await fileObj.save({
          file: parseFile,
          name: file,
          size,
          sha
        }, { sessionToken: this._token })
      }

      relation.add(fileObj)
      fileMap[sha] = file
    }))

    version.set('fileMap', fileMap)
    await version.save(null, { sessionToken: this._token })
  }

  async lsVersions() {
    const query = new Parse.Query(Version)
    const versions = await query.find({ sessionToken: this._token })
    return versions
  }

  async rmVersion(version) {
    return version.destroy({ sessionToken: this._token })
  }
}

const toRelative = (_path, base) => {
  const fullBase = base.endsWith(SEP) ? base : base + SEP
  let relative = _path.substr(fullBase.length)

  if (relative.startsWith(SEP)) {
    relative = relative.substr(1)
  }

  return relative.replace(/\\/g, '/')
}
