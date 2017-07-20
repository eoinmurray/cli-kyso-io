const path = require('path')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const pify = require('pify')
const tar = require('tar')
const fetch = require('node-fetch')
const progress = require('progress-stream')
const ProgressBar = require('progress')
const inquirer = require('inquirer')
const lifecycle = require('./utils/lifecycle')
const getGit = require('./utils/get-git')
const wait = require('./utils/output/wait')
const studyJSON = require('./get-study-json')
const { fileMapHash } = require('./utils/hash')
const { getFileList } = require('./utils/get-file-map')
const { versionHash } = require('./utils/hash')

const SEP = process.platform.startsWith('win') ? '\\' : '/'

const createVersion = async (pkg, dir, token, message, serverURL, { debug = false } = {}) => {
  let s = () => {}
  delete pkg._version // eslint-disable-line
  await lifecycle(pkg, 'preversion', dir, true)

  const files = await getFileList(dir, pkg, { debug })
  const versionSha = versionHash(files, message, { debug })

  const hiddenDir = path.join(dir, '.kyso')
  const tarPath = path.join(hiddenDir, `upload-${versionSha}.tgz`)
  await pify(mkdirp)(hiddenDir)
  await tar.c({ file: tarPath }, files.map(f => f.file))

  const url = serverURL.replace('/parse', '')
  const headers = {
    'X-Parse-Application-Id': 'api-kyso-io',
    'X-Parse-Session-Token': token,
  }

  const bar = new ProgressBar(`> Uploading version [:bar] :percent :etas`, {
    width: 40,
    complete: '=',
    incomplete: '',
    total: 100
  })

  const contentLength = (await fs.stat(tarPath)).size
  const fileMap = {}
  files.forEach(({ sha, file }) => {
    const mapSha = fileMapHash(sha, file)
    fileMap[mapSha] = file
  })

  let main = pkg.main || null
  const fnames = files
    .map(o => o.file)
    .filter(name => name.split(SEP).length === 1)

  if (!main) {
    if (fnames.includes('notebook.ipynb')) main = 'notebook.ipynb'
    if (fnames.includes('notebook.rmd')) main = 'notebook.rmd'
    if (fnames.includes('notebook.md')) main = 'notebook.md'
    if (fnames.includes('notebook.txt')) main = 'notebook.txt'
  }

  if (!main) {
    const choices = fnames.filter(name =>
      ['.ipynb', '.md'].includes(path.extname(name))
    )

    if (choices.length === 0) {
      const er = new Error(`\nCannot find any .md or .ipynb files. Refusing to make version.`)
      er.userError = true
      throw er
    }

    if (choices.length === 1) {
      main = choices[0]
    } else {
      const { _main } = await inquirer.prompt([{
        name: '_main',
        message: 'Which file is the main file?',
        type: 'list',
        choices
      }])

      main = _main
    }
  }

  studyJSON.merge(dir, { main })
  pkg.main = main // eslint-disable-line

  s = wait(`Creating version`)

  const startReq = await fetch(`${url}/functions/version-start`, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': 'api-kyso-io',
      'Content-type': 'application/json',
      'X-Parse-Session-Token': token
    },
    body: JSON.stringify({
      sha: versionSha,
      message,
      pkg,
      repository: await getGit(),
      main,
      filename: `upload-${versionSha}.tgz`,
      fileMap,
    })
  })

  const startBody = await startReq.json()

  if (startReq.status !== 200) {
    const err = new Error(`(${startReq.status} - ${startReq.statusText}) ${startBody.error}`)
    throw err
  }

  const { version, study, signedUrl } = startBody.result

  const body = {
    sha: versionSha,
    message,
    pkg,
    repository: await getGit(),
    main,
    filename: `upload-${versionSha}.tgz`,
    fileMap
  }

  headers.body = JSON.stringify(body)

  const str = progress({ length: contentLength, time: 100 })
  str.on('progress', p => bar.update(p.percentage / 100))

  const stream = fs.createReadStream(tarPath).pipe(str)
  stream.on('finish', () => { s = wait(`Saving version`) })

  s()

  const uploadReq = await fetch(`${signedUrl}`, { method: 'PUT', body: stream })
  const uploadBody = await uploadReq.text()
  if (uploadReq.status !== 200) {
    const err = new Error(`(${uploadReq.status} - ${uploadReq.statusText}) ${uploadBody}`)
    throw err
  }

  s(); s = wait(`Finalising version`)

  const finReq = await fetch(`${url}/functions/version-finish`, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': 'api-kyso-io',
      'Content-type': 'application/json',
      'X-Parse-Session-Token': token
    },
    body: JSON.stringify({
      filename: `upload-${versionSha}.tgz`,
      studyId: study.objectId,
      versionId: version.objectId
    })
  })

  const finBody = await finReq.json()
  if (finReq.status !== 200) {
    const err = new Error(`(${finReq.status} - ${finReq.statusText}) ${finBody.error}`)
    throw err
  }

  await lifecycle(pkg, 'postversion', dir, true)
  studyJSON.merge(dir, { _version: versionSha })
  s()
  return version
}

module.exports = createVersion
