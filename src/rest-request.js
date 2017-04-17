const fetch = require('node-fetch')
const secrets = require('./secrets')

const request = async (path, token) => {
  const res = await fetch(`${secrets.PARSE_SERVER_URL}/${path}`, {
    headers: {
      'X-Parse-Application-Id': secrets.PARSE_APP_ID,
      'X-Parse-REST-API-Key': secrets.PARSE_FILE_KEY,
      'X-Parse-Session-Token': token
    }
  })
  return res.json()
}

module.exports.getUser = async (token) => request('users/me', token)
