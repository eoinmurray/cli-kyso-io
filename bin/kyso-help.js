#!/usr/bin/env node
const chalk = require('chalk')
const exit = require('../src/utils/exit')

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso')} [options] <command | path>

  ${chalk.dim('Commands:')}

    TODO

  ${chalk.dim('Options:')}

    -h, --help                Output usage information
    -v, --version             Output the version number

  ${chalk.dim('Examples:')}

    TODO
`
  )
}

help()
exit(0)
