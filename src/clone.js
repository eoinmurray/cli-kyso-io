const fs = require('fs-extra')
const https = require('https')
const path = require('path')
const pify = require('pify')
const mkdirp = require('mkdirp')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')
const { fileMapHash } = require('./utils/hash')

const download = async (url, dest) => new Promise(async (resolve, reject) => { // eslint-disable-line
  await pify(mkdirp)(path.dirname(dest))
  const file = fs.createWriteStream(dest)

  const st = wait(`Downloading ${path.basename(dest)}`, 'bouncingBar')

  https
    .get(url, (response) => {
      response.pipe(file)
      file
        .on('finish', () => {
          file.close()
          st(true)
          resolve(dest)
        })
        .on('error', (err) => {
          fs.unlink(dest)
          st(true)
          reject(err)
        })
    })
})

module.exports = async (study, version, files, wd, { target = null, force = false, debug = false, throwExists = true } = {}) => { // eslint-disable-line
  if (!study) {
    const e = new Error(`Study has no files.`)
    e.userError = true
    throw e
  }

  const studyDir = path.join(wd, target || study.get('name'))
  try {
    await fs.stat(studyDir)
    if (throwExists) {
      const e = new Error(`Directory ${studyDir} already exists.`)
      e.userError = true
      throw e
    } else {
      if(!force) return // eslint-disable-line
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }

  const fileMap = version.get('fileMap')
  await pify(mkdirp)(studyDir)
  await Promise.all(files.map(async (file) => {
    const mapSha = fileMapHash(file.get('sha'), file.get('name'))

    const dest = path.join(studyDir, fileMap[mapSha])
    if (!file.get('file')) {
      return fs.writeFile(dest, '')
    }
    if (file.get('name') === 'study.json') {
      const st = wait(`Writing study.json`, 'bouncingBar')
      const pkg = version.get('pkg')
      pkg._version = version.get('sha')
      await fs.writeFile(dest, JSON.stringify(pkg, null, 2))
      return st(true)
    }

    _debug(debug, `Downloading ${file.get('name')} into ${dest}`)
    return download(file.get('file').url(), dest)
  }))
}
