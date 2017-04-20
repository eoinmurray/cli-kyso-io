#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const { eraseLines } = require('ansi-escapes')
const promptBool = require('../src/utils/input/prompt-bool')
const getCommandArgs = require('../src/command-args')
const { error, handleError } = require('../src/error')
const strlen = require('../src/strlen')
const exit = require('../src/utils/exit')
const Kyso = require('../src')


const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso versions')} <ls | create | rm> <versionname>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Lists all your versions:
      ${chalk.cyan('$ kyso versions ls')}

  ${chalk.gray('–')} Creates a version:
      ${chalk.cyan(`$ kyso versions create ${chalk.underline('"a commit message"')}`)}

  ${chalk.gray('–')} Removing a version:
      ${chalk.cyan('$ kyso versions rm <version>')}
`
  )
}

const clone = async (kyso, args) => {
  if (args.length === 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const name = String(args)

  if (!name.includes('/')) {
    const err = new Error(`Study "${name}" does not exist`)
    err.userError = true
    throw err
  }

  const teamName = name.split('/')[0]
  let studyName = name.split('/')[1]
  let versionSha = null

  if (studyName.includes('#')) {
    versionSha = studyName.split('#')[1]
    studyName = studyName.split('#')[0]

    if (versionSha.length < 6) {
      const err = new Error(`Version id must have at least 6-digits.`)
      err.userError = true
      throw err
    }
  }

  const start_ = new Date()

  console.log(`Cloning into ${studyName}`)
  await kyso.clone(studyName, teamName, versionSha)
  const elapsed_ = ms(new Date() - start_)
  console.log(`> Cloned study ${chalk.gray(`[${elapsed_}]`)}`)
  return true
}

(async () => {
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

    return await clone(kyso, subcommand)
  } catch (err) {
    return handleError(err)
  }
})()
