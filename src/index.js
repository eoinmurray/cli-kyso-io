const path = require('path')
const Parse = require('parse/node')

const getCommonVersion = require('./latest-common-version')
const createVersion = require('./create-version')
const createStudy = require('./create-study')
const currentVersion = require('./current-version')
const { merge, lsConflicts } = require('./merge')
const studyJSON = require('./get-study-json')
const getSVF = require('./get-svf')
const clone = require('./clone')
const secrets = require('./secrets')
const cfg = require('./kyso-cfg')

const lifecycle = require('./utils/lifecycle')
const findOne = require('./utils/find-one')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')
const hardRejection = require('hard-rejection')

hardRejection()

Parse.initialize(secrets.PARSE_APP_ID)
const Study = Parse.Object.extend('Study')
const Team = Parse.Object.extend('Team')
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

  async createStudy(studyName, teamName = null, requestPrivate) {
    let author = cfg.read().nickname
    // can specify the study author as username/studyname or teamname/studyname
    // author might be a team lets check
    if (teamName && teamName !== cfg.read().nickname) {
      _debug(this.debug, teamName)
      const s = wait(`Collecting user/team info`)
      const team = await findOne(teamName, Team, this._token, { throwENOENT: true })
      s()
      if (team) {
        author = team.get('name')
      }
    }

    const options = { debug: this.debug, pkg: this.hasStudyJson ? this.pkg : null }
    return createStudy(studyName, author, this._token, requestPrivate, options)
  }

  async lsStudies() {
    const query = new Parse.Query(Study)
    query.equalTo('author', cfg.read().nickname)
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

  async createVersion(message) {
    if (!this.hasStudyJson) {
      const error = new Error(`No study.json! Run 'kyso create <study-name> to make a study.'`)
      error.userError = true
      throw error
    }

    const version = await createVersion(this.pkg, this.dir, this._token, message, { debug: this.debug }) // eslint-disable-line
    return studyJSON.merge(this.dir, { _version: version.get('sha') })
  }

  async currentVersion(dest) {
    return currentVersion(dest, this.pkg, this._token, { debug: this.debug })
  }

  async lsVersions({ studyName = null } = {}) {
    if (!this.hasStudyJson && !studyName) {
      const error = new Error(`No study.json! Run 'kyso create <study-name> to make a study.'`)
      error.userError = true
      throw error
    }

    const study = await findOne(studyName || this.pkg.name, Study, this._token,
      { throwENOENT: true })
    const query = await study.relation('versions').query()
    query.descending('createdAt')
    const versions = await query.find({ sessionToken: this._token })
    return versions
  }

  async rmVersion(version) {
    return version.destroy({ sessionToken: this._token })
  }

  async run(cmd, cmdArgs) {
    // Note:to run a hook called prepush just run like so:
    // `lifecycle(this.pkg, 'prepush', this.dir, true)`
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

  async clone(studyName, author, { versionSha = null, target = null } = {}) {
    // Note: target is relative
    const s = wait(`Retrieving details of ${author}/${studyName}`)
    const { study, version, files } = await getSVF(studyName, author, this._token,
      { versionSha, debug: this.debug })
    s()

    await clone(study, version, files, this.dir, { target })
    const dest = target || path.join(this.dir, study.get('name'))
    return studyJSON.merge(dest, { _version: version.get('sha') })
  }

  async checkout(versionSha) {
    let s
    if (versionSha === 'latest') {
      s = wait(`Retrieving details of latest study`)
      const versions = await this.lsVersions()
      versionSha = versions[0].get('sha') // eslint-disable-line
      s()
    }

    s = wait(`Retrieving study versions and files`)
    const { study, version, files } = await getSVF(this.pkg.name, this.pkg.author, this._token,
      { versionSha, debug: this.debug })
    s()

    return clone(study, version, files, this.dir, { target: '.', throwExists: false, force: true })
  }

  async pullMerge(studyName, author, dest, { versionSha = null }) {
    let s = wait(`Retrieving details current study`)
    const currentStudy = await findOne(this.pkg.name, Study, this._token, { throwENOENT: true })
    s()

    s = wait(`Retrieving details of ${author}/${studyName}`)
    const {
      study: targetStudy,
      version: targetVersion,
      files: targetFiles
    } = await getSVF(studyName, author, this._token, { versionSha, debug: this.debug })
    s()

    s = wait(`Calculating the ancestor version`)
    const baseVersion = await getCommonVersion(currentStudy, targetStudy, this._token, { debug: this.debug }) // eslint-disable-line
    s()
    _debug(this.debug, `Target version: ${targetVersion.get('sha')}`)
    _debug(this.debug, `Base version: ${baseVersion.get('sha')}`)

    // download the target version
    const target = path.join('.kyso', 'merge', `target`)
    _debug(this.debug, `Downloading the target version ${targetVersion.get('sha')}`)

    console.log(`Pulling the fork`)
    await clone(targetStudy, targetVersion, targetFiles, this.dir, { target, debug: this.debug, throwExists: false }) // eslint-disable-line

    // download the base version
    s = wait(`Fetching the ancestor`)
    const base = path.join('.kyso', 'merge', `base`)
    _debug(this.debug, `Dowloading the base version`)
    const fileQuery = baseVersion.relation('files').query()
    const baseFiles = await fileQuery.find({ sessionToken: this._token })
    s()
    await clone(targetStudy, baseVersion, baseFiles, this.dir, { target: base, debug: this.debug, throwExists: false }) // eslint-disable-line
  }

  async applyMerge() {
    const target = path.join('.kyso', 'merge', `target`)
    const base = path.join('.kyso', 'merge', `base`)
    return merge(target, process.cwd(), base, { debug: this.debug })
  }

  async lsConflicts(dest) {
    return lsConflicts(path.resolve('.kyso', 'merge', 'target'), dest, { debug: this.debug })
  }
}
