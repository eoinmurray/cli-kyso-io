const path = require('path')
const fs = require('fs')
const fetch = require('node-fetch')
const Parse = require('parse/node')
const progress = require('progress-stream')
const ProgressBar = require('progress')
const secrets = require('./secrets')
const lifecycle = require('./utils/lifecycle')
const { fileMapHash } = require('./utils/hash')
const findOne = require('./utils/find-one')
const { getFileList } = require('./utils/get-file-map')
const { versionHash } = require('./utils/hash')
const getGit = require('./utils/get-git')
const resolveMain = require('./utils/resolve-main')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')
const cfg = require('./kyso-cfg')

const Version = Parse.Object.extend('Version')
const Study = Parse.Object.extend('Study')
const File = Parse.Object.extend('File')


const serial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([])) // eslint-disable-line


const upload = async (study, token, debug, dir, pkg, { sha, size, file, binary }) => {
  return new Promise(async (resolve, reject) => {
    let parseFile = await findOne(sha, File, token, { key: 'sha' })
    _debug(debug && parseFile, `Referencing ${file} (size ${size})`)

    if (!parseFile) {
      if (size === 0) {
        fileObj = new File()
        await fileObj.save({ file: null, name: file, size, sha, author: pkg.author },
          { sessionToken: token })
      }

      if (size > 0) {
        _debug(debug, `Uploading ${file} (size ${size})`)

        try {
          const contentLength = Buffer.byteLength(binary)
          const bar = new ProgressBar(`> Uploading ${file} [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: '',
            total: 100
          })

          const str = progress({ length: contentLength, time: 100 })

          str.on('progress', (p) => {
            bar.update(p.percentage / 100)
          })

          const body = fs
            .createReadStream(path.join(dir, file))
            .pipe(str)

          const url = debug ? 'http://localhost:8080/parse' : secrets.PARSE_SERVER_URL
          const res = await fetch(`${url}/files/${file}-${sha}`, {
            method: 'POST',
            headers: {
              //'Content-Type': 'text/plain',
              'X-Parse-Application-Id': secrets.PARSE_APP_ID,
              'X-Parse-REST-API-Key': secrets.PARSE_FILE_KEY,
              'X-Parse-Session-Token': token
            },
            body
          })

          const _upload = await res.json()
          if (Object.prototype.hasOwnProperty.call(_upload, 'error')) {
            return reject(new Error(_upload.error))
          }

          _upload.__type = 'File'
          parseFile = Parse.File.fromJSON(_upload)
        } catch (e) {
          reject(e)
        }
      }
    }

    const s = wait(`Finalizing ${file}`)
    const fileObj = new File()
    await fileObj.save({
      file: parseFile,
      name: file,
      size,
      study,
      sha,
      author: pkg.author },
    { sessionToken: token })
    s()
    resolve(fileObj)
  })
}

const createVersion = async (pkg, dir, token, message, { debug = false } = {}) => {
  // if no study.json we cant make a version
  await lifecycle(pkg, 'preversion', dir, true)

  // get the study from server if it exists, throwENOENT if not
  // then make relation to add version too
  let s = wait(`Fetching study details`)
  const study = await findOne(pkg.name, Study, token, { throwENOENT: true })
  const studyVersions = study.relation('versions')
  s()

  s = wait(`Initializing version`)
  // create a new version and files relation
  const version = new Version()
  version.set('message', message)
  const versionFiles = version.relation('files')
  const fileMap = {}

  // all this setting will be ignored if any errors happen since
  // the saves happen at the end of this function
  version.set('metadata', pkg.metadata || {})
  version.set('tags', pkg.tags || [])
  version.set('filesWhitelist', pkg.files || [])
  version.set('scripts', pkg.scripts || {})
  version.set('repository', await getGit())
  // get all the files in this dir, obeying the ignore rules etc
  const files = await getFileList(dir, pkg, { debug })
  const main = await resolveMain(files, pkg)
  version.set('main', main)
  s()
  s = wait(`Hashing files`)
  const versionSha = versionHash(files, message, { debug })
  s()
  s = wait(`Creating unique version`)
  const existingVersion = await findOne(versionSha, Version, token, { key: 'sha', debug })
  s()

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
  // pkg._version = `${pkg.author}/${pkg.name}#${versionSha}`
  // studyJSON.merge(dir, pkg)
  // lets keep a copy of the whole package in case there's any extra stuff the user wants
  version.set('pkg', pkg)

  const funcs = Array.from(files).map((file) => () => upload(study, token, debug, dir, pkg, file))

  const fileObjs = await serial(funcs)

  s = wait(`Adding uploaded files to version`)
  versionFiles.add(fileObjs)
  files.forEach(({ sha, file }) => {
    const mapSha = fileMapHash(sha, file)
    fileMap[mapSha] = file
  })

  // if everything good, then save version and study, add version to study
  // fileMap is an object with all the sha's and relative file paths
  version.set('fileMap', fileMap)
  s()
  s = wait(`Saving version`)
  version.set('author', cfg.read().nickname)
  version.set('study', study)
  await version.save(null, { sessionToken: token })
  _debug(debug, `Adding version to study.`)
  studyVersions.add(version)
  s()
  s = wait(`Saving study`)
  await study.save(null, { sessionToken: token })
  s()
  await lifecycle(pkg, 'postversion', dir, true)
  return version
}


module.exports = createVersion
