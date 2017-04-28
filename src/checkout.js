const fs = require('fs-promise')
const https = require('https')
const path = require('path')
const pify = require('pify')
const mkdirp = require('mkdirp')

const download = async (url, dest) => new Promise(async (resolve, reject) => { // eslint-disable-line
  await pify(mkdirp)(path.dirname(dest))
  const file = fs.createWriteStream(dest)
  https
    .get(url, (response) => {
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve(dest); })
      .on('error', (err) => { fs.unlink(dest); reject(err); }) // eslint-disable-line
    })
})

module.exports = async (study, version, files, wd, { target = null } = {}) => {
  const studyDir = path.join(wd, target || study.get('name'))
  try {
    await fs.stat(studyDir)
    const e = new Error(`Directory ${study.get('name')} already exists.`)
    e.userError = true
    throw e
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }

  const fileMap = version.get('fileMap')

  await fs.mkdir(studyDir)
  await Promise.all(files.map(async (file) => {
    const dest = path.join(studyDir, fileMap[file.get('sha')])
    if (!file.get('file')) {
      return fs.writeFile(dest, '')
    }
    if (file.get('name') === 'study.json') {
      return fs.writeFile(dest, JSON.stringify(version.get('pkg'), null, 2))
    }
    return download(file.get('file').url(), dest)
  }))
}
