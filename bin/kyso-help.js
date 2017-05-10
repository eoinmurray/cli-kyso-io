#!/usr/bin/env node
const chalk = require('chalk')
const exit = require('../src/utils/exit')
const getCommandArgs = require('../src/command-args')
const { version } = require('../src/pkg')
const { handleError } = require('../src/error')

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso')} [options] <command | path>

  ${chalk.dim('Commands:')}

    TODO

  ${chalk.dim('Options:')}

    -h, --help                Output usage information
    -v, --version             Output the version number
`
  )
}

(async () => {
  try {
    const { argv } = await getCommandArgs()

    if (argv.v || argv.version) {
      console.log(version)
      return exit(0)
    }

    help()
    return exit(0)
  } catch (err) {
    return handleError(err)
  }
})()
