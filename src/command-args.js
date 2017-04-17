const minimist = require('minimist')
const login = require('../src/login')
const cfg = require('../src/cfg')
const exit = require('../src/utils/exit')
const { error } = require('../src/error')

module.exports = async () => {
  const argv = minimist(process.argv.slice(2), {
    boolean: [
      'help'
    ],
    alias: {
      help: 'h'
    }
  })

  const args = argv._.slice(1)
  const subcommand = argv._[0]
  const apiUrl = argv.url || 'https://api.kyso.io'

  const config = cfg.read()
  let token = config.token

  if (!config.token) {
    try {
      token = await login()
    } catch (err) {
      error(`Authentication error - ${err.message}`)
      exit(1)
    }
  }

  return { args, subcommand, token, apiUrl, argv }
}
