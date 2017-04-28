const path = require('path')
const fs = require('fs-promise')
const Parse = require('parse/node')
const makeTemplate = require('./study-template')
const studyJSON = require('./get-study-json')
const findOne = require('./utils/find-one')
const _debug = require('./utils/output/debug')
const wait = require('./utils/output/wait')

const Study = Parse.Object.extend('Study')

const createStudy = async (studyName, author, token, { debug = false, pkg = null } = {}) => {
  let s = wait(`Checking for existing study`)
  const existingStudy = await findOne(studyName, Study, token)
  s()
  const dir = process.cwd()

  // throw error if study exists with same name
  if (existingStudy) {
    const error = new Error(`Study ${author}/${studyName} already exists.`)
    error.userError = true
    throw error
  }

  // everything is create lets make a study
  // it will do permissions setting on the server
  const study = new Study()

  // if there exists a studyJSON then we are extending a study
  if (pkg && existingStudy) {
    s = wait(`Reinitializing study ${pkg.name}`)
    const targetStudy = await findOne(pkg.name, Study, token)
    const query = await targetStudy.relation('versions').query()
    const versions = await query.find({ sessionToken: token })
    s()
    const relation = study.relation('versions')
    versions.forEach(version => relation.add(version))
  }

  study.set('name', studyName)
  study.set('author', author)
  s = wait(`Creating study: ${author}/${studyName}`)
  await study.save(null, { sessionToken: token })
  s()

  // all good so lets write the study.json
  s = wait(`Initializing locally`)
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
