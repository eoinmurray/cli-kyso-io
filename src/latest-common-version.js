const _debug = require('./utils/output/debug')

module.exports = async (study1, study2, token, { debug = null } = {}) => {
  _debug(debug, `Finding common origin between ${study1.get('name')} and ${study2.get('name')}`)

  const versionsQuery1 = study1.relation('versions').query()
  versionsQuery1.descending('createdAt')
  const versionsQuery2 = study2.relation('versions').query()
  versionsQuery2.descending('createdAt')

  const versions1 = await versionsQuery1.find({ sessionToken: token })
  const versions2 = await versionsQuery2.find({ sessionToken: token })

  const ids1 = versions1.map(v => v.id)
  const ids2 = versions2.map(v => v.id)

  const commons = ids1.filter(id => ids2.includes(id))
  if (commons.length > 0) {
    const commonId = commons[0]
    _debug(debug, `Found ${commons.length} common versions, returning latest.`)
    return versions1.filter(v => v.id === commonId)[0]
  }

  _debug(debug, `Found no common versions.`)
  return null
}
