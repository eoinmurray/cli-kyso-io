const path = require('path')
const fs = require('fs-extra')
const Parse = require('parse/node')
const makeTemplate = require('./study-template')
const studyJSON = require('./get-study-json')
const wait = require('./utils/output/wait')

const createStudy = async (studyName, author, token, requestPrivate, { pkg = null } = {}) => {
  const s = wait(`Creating study: ${author}/${studyName}`)

  try {
    await Parse.Cloud.run('createStudy', {
      name: studyName,
      author,
      requestPrivate
    }, { sessionToken: token })
  } catch (e) {
    s()
    throw e
  }

  const dir = process.cwd()
  if (!pkg) {
    const template = await makeTemplate({ name: studyName, author })
    await fs.writeFile(path.join(dir, 'study.json'), template)
    s()
    return true
  }

  await studyJSON.merge(dir, { name: studyName, author })
  s()
  return true
}


module.exports = createStudy
