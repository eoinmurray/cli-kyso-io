#!/usr/bin/env node
const chalk = require('chalk')
const getCommandArgs = require('../src/command-args')
const { error, handleError } = require('../src/error')
const Kyso = require('../src')
const Docker = require('../src/docker')
const exit = require('../src/utils/exit')

const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso docker')}

  Run various commands inside the kyso/jupyter docker image.

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('kyso jupyter')} Opens a Jupyter notebook

  ${chalk.gray('kyso dashboard')} Starts the current dir as a Jupyter dashboard

  ${chalk.gray('kyso jupyter-http')} Starts a notebook in http mode

  ${chalk.gray('kyso python')} or ${chalk.gray('kyso python3')} Starts python3.5

  ${chalk.gray('kyso python2')} Starts python2.7

  ${chalk.gray('kyso node')} Starts node.js

  ${chalk.gray('kyso bash')} Starts bash inside the container

  ${chalk.gray('kyso bash-keep')} Starts bash inside the container

  ${chalk.gray('kyso docker run')} Starts the default docker command

  If you want to extend the image - for example to do a 'pip install' of
  some special libraries. If you have a requirements.txt in your folder
  Kyso will create a custom Dockerfile where the requirements are included.
  You can also use the Dockerfile to run custom commands in the image.
`
  )
}

;(async () => {
  try {
    const { argv, subcommand, token, apiUrl } = await getCommandArgs()

    if (argv.help || !subcommand) {
      help()
      return exit(0)
    }

    const kyso = new Kyso({
      url: apiUrl,
      token,
      debug: argv.debug,
      dir: process.cwd()
    })

    const docker = new Docker(kyso)
    const args = process.argv.slice(3)

    if (subcommand === 'jupyter') {
      return await docker.jupyter(args)
    }

    if (subcommand === 'dashboard') {
      return await docker.dashboard(args)
    }

    if (subcommand === 'jupyter-http') {
      return await docker.jupyterHttp(args)
    }

    if (subcommand === 'python3' || subcommand === 'python') {
      return await docker.python3(args)
    }

    if (subcommand === 'python2') {
      return await docker.python2(args)
    }

    if (subcommand === 'node') {
      return await docker.node(args)
    }

    if (subcommand === 'bash') {
      return await docker.bash(args)
    }

    if (subcommand === 'bash-keep') {
      return await docker.bashKeep(args)
    }

    if (subcommand === 'build') {
      return await docker.build(args)
    }

    if (subcommand === 'extend') {
      return await docker.extend(args)
    }

    if (subcommand === 'run') {
      return await docker.default(args)
    }

    error('Please specify a valid subcommand: ls | add | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
