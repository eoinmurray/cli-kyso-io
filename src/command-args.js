const minimist = require('minimist')
const login = require('../src/login')
const cfg = require('../src/kyso-cfg')
const exit = require('../src/utils/exit')
const { error } = require('../src/error')

module.exports = async ({ noLogin = false } = {}) => {
  const argv = minimist(process.argv.slice(2), {
    boolean: [
      'help',
      'debug',
      'private'
    ],
    alias: {
      help: 'h',
      debug: 'd',
      private: 'p'
    }
  })

  const args = argv._.slice(1)
  const subcommand = argv._[0]
  const apiUrl = argv.debug ? 'http://localhost:8080/parse' : 'https://api.kyso.io/parse'

  const config = cfg.read()
  let token = config.token

  if (!config.token) {
    try {
      if (!noLogin) {
        token = await login({ debug: argv.debug, url: apiUrl })
      }
    } catch (err) {
      // error(`Authentication error - ${err.message}`)
      console.error(err)
      exit(1)
    }
  }

  return { args, subcommand, token, apiUrl, argv }
}
