const { resolve: resolvePath } = require('path')
const { readFile, writeFile } = require('fs-promise')

const read = async (path) => {
  let studyConfig = null
  let hasStudyJson = false

  try {
    studyConfig = JSON.parse(await readFile(resolvePath(path, 'study.json')))
    hasStudyJson = true
  } catch (err) {
    // If the file doesn't exist then that's fine any other error bubbles up
    if (err.code !== 'ENOENT') {
      const e = Error(`Failed to read JSON in "${path}/study.json"`)
      e.userError = true
      throw e
    }
  }

  return {
    studyConfig,
    hasStudyJson
  }
}

const merge = async (path, data) => {
  const cfg = Object.assign({}, await read(path), data)
  return writeFile(resolvePath(path, 'study.json'), JSON.stringify(cfg, null, 2))
}

module.exports = { read, merge }
