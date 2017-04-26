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
  ${chalk.bold('kyso clone')} author/studyname

  ${chalk.dim('Options:')}
    -h, --help              Output usage information

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Clone latest version of a users study:
      ${chalk.cyan('$ kyso clone username/studyname')}

  ${chalk.gray('–')} Clone latest version of a teams study:
      ${chalk.cyan('$ kyso clone team/studyname')}

  ${chalk.gray('–')} Clone a specific version:
      ${chalk.cyan('$ kyso clone username/studyname#d46hdv')}
`
  )
}

const clone = async (kyso, args) => {
  if (args.length === 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const name = String(args[0])
  let target = null
  if (args.length === 2) {
    target = String(args[1])
  }

  if (!name.includes('/')) {
    const err = new Error(`Study name must be in the form author/name`)
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

  console.log(`Cloning into ${target || studyName}`)
  await kyso.clone(studyName, teamName, { versionSha, target })
  const elapsed_ = ms(new Date() - start_)
  console.log(`> Cloned study ${chalk.gray(`[${elapsed_}]`)}`)
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

    return await clone(kyso, [subcommand].concat(args))
  } catch (err) {
    return handleError(err)
  }
})()
