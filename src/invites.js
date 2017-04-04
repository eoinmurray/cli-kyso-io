const Parse = require('parse/node')
const secrets = require('./secrets')

Parse.initialize(secrets.PARSE_APP_ID)
Parse.serverURL = secrets.PARSE_SERVER_URL
const Invite = Parse.Object.extend('Invite')

module.exports = class Invites {
  constructor(url, token, { debug }) {
    this._url = url
    this._token = token
    this._debug = debug;
  }

  async ls() {
    const query = new Parse.Query(Invite)
    const invites = await query.find({ sessionToken: this._token })
    await Promise.all(
      invites.map((invite) => invite.get('team').fetch({ sessionToken: this._token }))
    )
    return invites
  }

  async create(targetEmail, teamName) {
    const invite = new Invite()
    invite.set('targetEmail', targetEmail)
    invite.set('targetTeam', teamName)
    return invite.save(null, { sessionToken: this._token })
  }

  async rm(invite) {
    return invite.destroy({ sessionToken: this._token })
  }
}
