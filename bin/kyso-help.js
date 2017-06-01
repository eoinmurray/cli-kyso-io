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

    create      [name]      Creates a new study
    push        [message]   Pushes a new version to Kyso
    list                    Lists versions of the current study
    status                  Shows the current status of the study
    start                   Start a Jupyter notebook in the current dir
    clone       [study]     Clones a study to a local folder
    checkout    [hash]      Checks out a study version
    merge                   Manages the merging of different versions
    run          [cmd]      Run scripts that are defined in the study.json
    docker                  Manages the running of Docker from Kyso

    help                    Shows this help page
    login                   Authenticates this device
    studies                 Manage your studies
    versions                Manage your versions
    invites                 Manage your invites
    teams                   Manage your teams
    tags                    Add tags to the current study
    docs                    Opens the Kyso documentation in a web browser
    browse                  Opens the current study in a web browser

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
