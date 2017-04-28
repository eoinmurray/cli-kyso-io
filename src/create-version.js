const Parse = require('parse/node')
const lifecycle = require('./utils/lifecycle')
const { fileMapHash } = require('./utils/hash')
const findOne = require('./utils/find-one')
const { getFileList } = require('./utils/get-file-map')
const { versionHash } = require('./utils/hash')
const getGit = require('./utils/get-git')
const resolveMain = require('./utils/resolve-main')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')

const Version = Parse.Object.extend('Version')
const Study = Parse.Object.extend('Study')
const File = Parse.Object.extend('File')

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

  // add everything to version
  // all this setting will be ignored if any errors happen since
  // the saves happen at the end of this function
  version.set('metadata', pkg.metadata || {})
  version.set('tags', pkg.tags || [])
  version.set('filesWhitelist', pkg.files || [])
  version.set('scripts', pkg.scripts || {})
  // lets keep a copy of the whole package in case there's any extra stuff the user wants
  version.set('repository', await getGit())
  // get all the files in this dir, obeying the ignore rules etc
  const files = await getFileList(dir, pkg, { debug })
  const main = await resolveMain(files, pkg)
  version.set('main', main)
  // TODO: create version hash
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
  // pkg._last_version = `${pkg.author}/${pkg.name}#${versionSha}`
  // studyJSON.merge(dir, pkg)
  version.set('pkg', pkg)

  // big job here! upload all the files if nessecary
  // or get the ref, and add to the version
  await Promise.all(
    Array.from(files).map(async ({ sha, size, file, data }) => {
      // if file exists add it to the version, otherwise upload and make new file
      const st = wait(`Uploading ${file} (size ${size})`, 'bouncingBar')
      let fileObj = await findOne(sha, File, token, { key: 'sha' })
      _debug(debug && fileObj, `Referencing ${file} (size ${size})`)
      if (!fileObj) {
        _debug(debug, `Uploading ${file} (size ${size})`)
        let _upload = null
        if (size > 0) {
          _upload = new Parse.File(sha, { base64: data })
          await _upload.save({ sessionToken: token })
        }

        fileObj = new File()
        await fileObj.save({ file: _upload, name: file, size, sha, author: pkg.author }, { sessionToken: token }) // eslint-disable-line
      }
      st(true)
      versionFiles.add(fileObj)

      const mapSha = fileMapHash(sha, file)
      fileMap[mapSha] = file
    })
  )
  // if everything good, then save version and study, add version to study
  // fileMap is an object with all the sha's and relative file paths
  version.set('fileMap', fileMap)
  version.set('author', pkg.author)
  s = wait(`Saving version`)
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
