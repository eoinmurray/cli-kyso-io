const Parse = require('parse/node')
const { fileMapHash } = require('./utils/hash')

module.exports = async (studyname, author, token, { versionSha = null } = {}) => {
  const { study, versions, files } = await Parse.Cloud.run('getStudyComplete',
    { author, studyname, limit: 1, sha: versionSha }, { sessionToken: token })

  if (files.length) {
    const version = versions[0]
    const shas = Object.keys(version.get('fileMap'))

    return {
      study,
      version,
      files: files.filter(f => shas.includes(fileMapHash(f.get('sha'), f.get('name'))))
    }
  }

  return { study: null, version: null, files: [] }
}
