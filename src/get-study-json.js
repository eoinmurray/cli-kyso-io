const { resolve: resolvePath } = require('path')
const { readFileSync, writeFileSync } = require('fs')

const read = (path) => {
  let studyConfig = null
  let hasStudyJson = false

  try {
    studyConfig = JSON.parse(readFileSync(resolvePath(path, 'study.json')))
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

const merge = (path, data) => {
  const { studyConfig } = read(path)
  const cfg = Object.assign(studyConfig, data)
  return writeFileSync(resolvePath(path, 'study.json'), JSON.stringify(cfg, null, 2))
}

module.exports = { read, merge }
