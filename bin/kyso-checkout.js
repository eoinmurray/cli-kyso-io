#!/usr/bin/env node
const chalk = require('chalk')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const { error, handleError } = require('../src/error')
const exit = require('../src/utils/exit')
const Kyso = require('../src')


const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso checkout')} <versionhash>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Checkout an older version:
      ${chalk.cyan('$ kyso checkout ed3f4f')}

  ${chalk.gray('–')} Checkout the latest:
    ${chalk.cyan('$ kyso checkout latest')}
  `
  )
}

const checkout = async (kyso, args) => {
  if (args.length === 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const versionSha = String(args[0])
  const start_ = new Date()
  await kyso.checkout(versionSha)
  const elapsed_ = ms(new Date() - start_)
  console.log(`> Checked out study ${chalk.gray(`[${elapsed_}]`)}`)
  return true
}

(async () => {
  try {
    const { argv, args, subcommand, token, apiUrl } = await getCommandArgs()
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

    return await checkout(kyso, [subcommand].concat(args))
  } catch (err) {
    return handleError(err)
  }
})()
