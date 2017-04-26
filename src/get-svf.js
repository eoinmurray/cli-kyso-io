const Parse = require('parse/node')
const _debug = require('./utils/output/debug')

const Study = Parse.Object.extend('Study')

module.exports = async (studyName, author, token, { versionSha = null, debug = null } = {}) => {
  const query = new Parse.Query(Study)
  query.equalTo('name', studyName)
  query.equalTo('author', author)

  _debug(debug, `Fetching ${author}/${studyName}`)
  const results = await query.find({ sessionToken: token })
  if (results.length === 0) {
    const error = new Error(`No Study called ${author}/${studyName}, or you don't have permission.`)
    error.userError = true
    throw error
  }

  const study = results[0]

  const versionsQuery = study.relation('versions').query()

  if (versionSha) {
    _debug(debug, `Fetching version with sha ${versionSha}`)
    versionsQuery.startsWith('sha', versionSha)
  } else {
    versionsQuery.limit(1)
    versionsQuery.descending('createdAt')
  }

  const versions = await versionsQuery.find({ sessionToken: token })

  if (!versions.length) {
    let err = new Error(`No versions of ${study.get('name')} found`)
    if (versionSha) {
      err = new Error(`No matching versions of ${study.get('name')} found`)
    }
    err.userError = true
    throw err
  }

  const version = versions[0]

  const fileQuery = version.relation('files').query()
  const files = await fileQuery.find({ sessionToken: token })

  if (!files.length) {
    const err = new Error(`No files in ${study.get('name')} version ${version.get('sha').slice(0, 6)} found`)
    err.userError = true
    throw err
  }

  return { study, version, files }
}
