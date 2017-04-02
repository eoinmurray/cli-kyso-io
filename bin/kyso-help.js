#!/usr/bin/env node

// Native
const { resolve } = require('path');

// Packages
const chalk = require('chalk')
const exit = require('../src/utils/exit')

const help = () => {
  console.log(
    `
  ${chalk.bold(`kyso`)} [options] <command | path>

  ${chalk.dim('Commands:')}

    init                 [path]       Initializes a study
    help                 [cmd]        Displays complete help for [cmd]

  ${chalk.dim('Options:')}

    -h, --help                Output usage information
    -v, --version             Output the version number

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Initializes a study

    ${chalk.cyan('$ kyso init <study name>')}
`
  )
}

help()
exit(0)
