const path = require('path')
const fs = require('fs-promise')
const mkdirp = require('mkdirp')
const pify = require('pify')
const tar = require('tar')
const fetch = require('node-fetch')
const progress = require('progress-stream')
const ProgressBar = require('progress')
const secrets = require('./secrets')
const lifecycle = require('./utils/lifecycle')
const getGit = require('./utils/get-git')
const resolveMain = require('./utils/resolve-main')
const wait = require('./utils/output/wait')
const studyJSON = require('./get-study-json')
const { fileMapHash } = require('./utils/hash')
const { getFileList } = require('./utils/get-file-map')
const { versionHash } = require('./utils/hash')

const createVersion = async (pkg, dir, token, message, { debug = false } = {}) => {
  delete pkg._version // eslint-disable-line
  await lifecycle(pkg, 'preversion', dir, true)

  const files = await getFileList(dir, pkg, { debug })
  const versionSha = versionHash(files, message, { debug })

  const hiddenDir = path.join(dir, '.kyso')
  const tarPath = path.join(hiddenDir, `upload-${versionSha}.tgz`)
  await pify(mkdirp)(hiddenDir)
  await tar.c({ file: tarPath }, files.map(f => f.file))

  const url = debug ? 'http://localhost:8080' : secrets.PARSE_SERVER_URL.replace('/parse', '')
  const headers = {
    'X-Parse-Application-Id': secrets.PARSE_APP_ID,
    'X-Parse-REST-API-Key': secrets.PARSE_FILE_KEY,
    'X-Parse-Session-Token': token,
  }

  const bar = new ProgressBar(`> Uploading version [:bar] :percent :etas`, {
    width: 40,
    complete: '=',
    incomplete: '',
    total: 100
  })

  const contentLength = (await fs.stat(tarPath)).size
  const str = progress({ length: contentLength, time: 100 })
  str.on('progress', p => bar.update(p.percentage / 100))
  const stream = fs.createReadStream(tarPath).pipe(str)
  let s = () => {}
  stream.on('finish', () => { s = wait(`Saving version`) })

  const fileMap = {}
  files.forEach(({ sha, file }) => {
    const mapSha = fileMapHash(sha, file)
    fileMap[mapSha] = file
  })

  const body = {
    sha: versionSha,
    message,
    pkg,
    repository: await getGit(),
    main: await resolveMain(files, pkg),
    filename: `upload-${versionSha}.tgz`,
    fileMap
  }

  headers.body = JSON.stringify(body)
  const res = await fetch(`${url}/create-version`, { method: 'POST', body: stream, headers })
  const response = await res.json()

  s()
  if (response.hasOwnProperty('error')) { // eslint-disable-line
    const err = new Error(response.error)
    err.userError = true
    throw err
  }

  await lifecycle(pkg, 'postversion', dir, true)
  console.log('Version saved.')
  return studyJSON.merge(dir, { _version: versionSha })
}

module.exports = createVersion
