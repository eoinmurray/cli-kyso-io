const chalk = require('chalk')

// Prints an informational message
module.exports = (bool, msg) => {
  if (bool) console.log(`${chalk.gray('[debug]')} ${msg}`)
}
