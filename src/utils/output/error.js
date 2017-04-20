const chalk = require('chalk')

// Prints an error message
module.exports = msg => {
  if (msg instanceof Error) {
    msg = msg.message // eslint-disable-line
  }

  console.error(`${chalk.red('> Error!')} ${msg}`)
}
