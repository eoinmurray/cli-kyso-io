const path = require('path')
const Parse = require('parse/node')
const fs = require('fs-promise')
const cfg = require('../src/cfg')
const secrets = require('./secrets')
const studyJSON = require('./get-metadata')
const makeTemplate = require('./study-template')
const lifecycle = require('./utils/lifecycle')
const getFileMap = require('./utils/get-file-map')
const resolveMain = require('./utils/resolve-main')
const { versionHash } = require('./utils/hash')
const findOne = require('./utils/find-one')
const getGit = require('./utils/get-git')
const _debug = require('./utils/output/debug')

Parse.initialize(secrets.PARSE_APP_ID)
const Study = Parse.Object.extend('Study')
const Version = Parse.Object.extend('Version')
const Team = Parse.Object.extend('Team')
const File = Parse.Object.extend('File')
const Invite = Parse.Object.extend('Invite')

module.exports = class Kyso {
  constructor({ url, token, debug = false, dir = process.cwd() }) {
    Parse.serverURL = url
    this._token = token
    this.dir = dir
    this.debug = debug
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
    // can specify the study author as username/studyname or teamname/studyname
    if (name.includes('/')) {
      teamName = name.split('/')[0]
      studyName = name.split('/')[1]
    }
    // lets abort if there is already a study.json
    if (this.hasStudyJson) {
      const error = new Error(`study.json already exists in this directory.`)
      error.userError = true
      throw error
    }
    // author might be a team lets check
    if (teamName && teamName !== cfg.read().nickname) {
      _debug(this.debug, teamName)
      const team = await findOne(teamName, Team, this._token, { throwENOENT: true })
      if (team) {
        author = team.get('name')
      }
    }
    // will throw error if study exists
    const existingStudy = await findOne(studyName, Study, this._token)
    if (existingStudy) {
      const error = new Error(`Study ${author}/${studyName} already exists.`)
      error.userError = true
      throw error
    }
    // everything is create lets make a study
    // it will do permissions setting on the server
    const study = new Study()
    study.set('name', studyName)
    study.set('author', author)
    await study.save(null, { sessionToken: this._token })
    // all good so lets write the study.json
    const template = await makeTemplate({ name: studyName, author })
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
    // all permissions setting is handled on the server
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
    // tags is either the existing tags or a new array
    const _tags = this.pkg.tags || []
    // throw error if tag already exists
    if (_tags.includes(tag)) {
      const error = new Error('Tag already exists.')
      error.userError = true
      throw error
    }

    // push tag and create list of unique tags only
    _tags.push(tag)
    const tags = _tags
      .filter((val, index, array) => array.indexOf(val) === index)
    // then merge into study.json
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
    /*
    DEV:
      to run a hook called prepush just run like so:
      `return lifecycle(this.pkg, 'prepush', this.dir, true)`
    */
    // check if we have any scripts defined,
    // and check if specified command exists
    this.pkg.scripts = this.pkg.scripts || {}
    if (!this.pkg.scripts[cmd]) {
      const error = new Error(`Command "${cmd}" not found in scripts`)
      error.userError = true
      throw error
    }
    // if all good then try run the scripts
    this.pkg.scripts[cmd] = this.pkg.scripts[cmd] + cmdArgs
    return lifecycle(this.pkg, cmd, this.dir, true)
  }

  async createVersion(message) {
    // if no study.json we cant make a version
    if (!this.hasStudyJson) {
      const error = new Error(`No study.json! Run 'kyso create <study-name> to make a study.'`)
      error.userError = true
      throw error
    }

    // get the study from server if it exists, throwENOENT if not
    // then make relation to add version too
    const study = await findOne(this.pkg.name, Study, this._token, { throwENOENT: true })
    const studyVersions = study.relation('versions')

    // create a new version and files relation
    const version = new Version()
    version.set('message', message)
    const versionFiles = version.relation('files')
    const fileMap = {}

    // add everything to version
    // all this setting will be ignored if any errors happen since
    // the saves happen at the end of this function
    version.set('metadata', this.pkg.metadata || {})
    version.set('tags', this.pkg.tags || [])
    version.set('filesWhitelist', this.pkg.files || [])
    version.set('scripts', this.pkg.scripts || {})
    // fileMap is an object with all the sha's and relative file paths
    version.set('fileMap', fileMap)
    // lets keep a copy of the whole package in case there's any extra stuff the user wants
    version.set('pkg', this.pkg)
    version.set('repository', await getGit())
    // get all the files in this dir, obeying the ignore rules etc
    const files = await getFileMap(this.dir, this.pkg, { debug: this.debug })
    const main = await resolveMain(files, this.pkg)
    version.set('main', main)
    // TODO: create version hash

    const versionSha = versionHash(files, message, { debug: this.debug })
    const existingVersion = await findOne(versionSha, Version, this._token, { key: 'sha', debug: this.debug })

    if (existingVersion) {
      const err = new Error(`
A version with the same sha exists, meaning no files have changed.
The clashing version is:
commit: ${existingVersion.get('sha')}
message: ${existingVersion.get('message')}`)
      err.userError = true
      throw err
    }

    version.set('sha', versionSha)
    // big job here! upload all the files if nessecary, or get the ref, and add to the version
    await Promise.all(
      Array.from(files).map(async ({ sha, size, file, data }) => {
        // check if file exists, if so add it to the version, otherwise upload and make new file
        let fileObj = await findOne(sha, File, this._token, { key: 'sha' })
        _debug(this.debug && fileObj, `Referencing ${file} (size ${size})`)
        if (!fileObj) {
          _debug(this.debug, `Uploading ${file} (size ${size})`)
          let _upload = null
          if (size > 0) {
            _upload = new Parse.File(sha, { base64: data })
            await _upload.save({ sessionToken: this._token })
          }

          fileObj = new File()
          await fileObj.save({ file: _upload, name: file, size, sha, author: this.pkg.author }, { sessionToken: this._token }) // eslint-disable-line
        }
        versionFiles.add(fileObj)
        fileMap[sha] = file
      })
    )

    // if everything good, then save version and study
    // add version to study
    version.set('author', this.pkg.author)
    await version.save(null, { sessionToken: this._token })
    _debug(this.debug, `Adding version to study.`)
    studyVersions.add(version)
    await study.save(null, { sessionToken: this._token })
    return true
  }

  async lsVersions() {
    if (!this.hasStudyJson) {
      const error = new Error(`No study.json! Run 'kyso create <study-name> to make a study.'`)
      error.userError = true
      throw error
    }

    const study = await findOne(this.pkg.name, Study, this._token, { throwENOENT: true })
    const query = await study.relation('versions').query()
    const versions = await query.find({ sessionToken: this._token })
    return versions
  }

  async rmVersion(version) {
    return version.destroy({ sessionToken: this._token })
  }
}
