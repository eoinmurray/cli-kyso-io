#!/usr/bin/env node
const chalk = require('chalk')
const exit = require('../src/utils/exit')

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso')} [options] <command | path>

  ${chalk.dim('Commands:')}

    studies              [cmd]        Manages your studies
    teams                [cmd]        Manages your teams
    invites              [cmd]        Manages invitations to your teams
    help                 [cmd]        Displays complete help for [cmd]

  ${chalk.dim('Options:')}

    -h, --help                Output usage information
    -v, --version             Output the version number

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Initializes a study

    ${chalk.cyan('$ kyso create <study name>')}
`
  )
}

help()
exit(0)
