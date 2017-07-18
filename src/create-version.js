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

  const mb = contentLength / 1000000.0
  if (mb > 32) {
    const err = new Error('Studies are currently limited to 32mb on the free plan.')
    err.userError = true
    throw err
  }

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
  let s = () => {}
  stream.on('finish', () => { s = wait(`Saving version`) })

  const res = await fetch(`${url}/create-version`, { method: 'POST', body: stream, headers })
  if (res.status !== 200) {
    const err = new Error(res.statusText)
    throw err
  }
  const version = await res.json()
  s()

  if (version.hasOwnProperty('error')) { // eslint-disable-line
    const err = new Error(version.error)
    err.userError = true
    throw err
  }

  await lifecycle(pkg, 'postversion', dir, true)
  studyJSON.merge(dir, { _version: versionSha })
  return version
}

module.exports = createVersion
