
const Parse = require('parse/node')
const _debug = require('./output/debug')

module.exports = async (val, ParseClass, _token, { key = 'name', throwENOENT = false, debug = false } = {}) => {
  const query = new Parse.Query(ParseClass)

  _debug(debug, `Querying ${ParseClass.className} for ${key}=${val}`)
  query.equalTo(key, val)

  const results = await query.find({ sessionToken: _token })

  _debug(debug, `Found ${results.length} results for ${key}=${val}`)
  if (results.length !== 0) {
    return results[0]
  } else if (throwENOENT) {
    const error = new Error(`No ${ParseClass.className} called ${val}, or you don't have permission.`)
    error.userError = true
    throw error
  } else {
    return null
  }
}
