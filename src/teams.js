const Parse = require('parse/node')
const secrets = require('./secrets')

Parse.initialize(secrets.PARSE_APP_ID)
Parse.serverURL = secrets.PARSE_SERVER_URL

const Team = Parse.Object.extend('Team')

module.exports = class Teams {
  constructor(url, token, { debug }) {
    this._url = url
    this._token = token
    this._debug = debug;
  }

  async ls() {
    const query = new Parse.Query(Team)
    const teams = await query.find({ sessionToken: this._token })
    return teams
  }

  async create(name) {
    const team = new Team()
    team.set('name', name)

    return team.save(null, { sessionToken: this._token })
  }

  async rm(team) {
    return team.destroy({ sessionToken: this._token })
  }
}
