const chalk = require('chalk')
const spinner = require('./wait')

// Prints an error message
module.exports = msg => {
  if (msg instanceof Error) {
    msg = msg.message // eslint-disable-line
  }

  if (spinner.stop) spinner.stop()
  console.error(`\n${chalk.red('> Error!')} ${msg}`)
}
