const Parse = require('parse/node')

module.exports = async (studyname, author, token, { versionSha = null } = {}) => {
  const { study } = await Parse.Cloud.run('getStudyComplete',
    { author, studyname, limit: 1, sha: versionSha }, { sessionToken: token })

  if (study) {
    let version = null
    let files = null
    if (study.get('versionsArray') && study.get('versionsArray').length) {
      version = study.get('versionsArray')[0]
      files = version.get('filesArray')
    }

    return {
      study,
      version,
      files
    }
  }

  return { study: null, version: null, files: [] }
}
