const ora = require('ora')
const chalk = require('chalk')
const { eraseLine } = require('ansi-escapes')


// Prints a spinner followed by the given text
function _spinner(msg, style = 'dots') {
  _spinner.stop = () => {}

  const spinner = ora({ text: chalk.gray(msg), spinner: style })
  spinner.color = 'gray'
  spinner.start()

  _spinner.stop = (succeed = false) => {
    if (succeed) {
      spinner.succeed()
    } else {
      spinner.stop()
      process.stdout.write(eraseLine)
    }
  }

  return _spinner.stop
}

module.exports = _spinner
