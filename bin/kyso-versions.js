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

const ls = async (kyso, args) => {
  if (args.length !== 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start_ = new Date()
  const versionList = await kyso.lsVersions()
  versionList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const current = new Date()
  const header = [
    ['created', 'version (6-digits)', 'message'].map(s => chalk.dim(s))
  ]

  let out = null
  if (versionList.length !== 0) {
    out = table(header.concat(
        versionList.map(t => {
          const time = chalk.gray(`${ms(current - new Date(t.createdAt))} ago`)
          return [time, t.get('sha').slice(0, 6), t.get('message')]
        })
      ), {
        align: ['l', 'l', 'l', 'l', 'l', 'l'],
        hsep: ' '.repeat(2),
        stringLength: strlen
      }
    )
  }

  const elapsed_ = ms(new Date() - start_)
  console.log(`> ${versionList.length} version${versionList.length === 1 ? '' : 's'} found ${chalk.gray(`[${elapsed_}]`)}`)
  if (out) { console.log(`\n${out}\n`) }
  return true
}

const rm = async (kyso, args) => {
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const _target = String(args[0])
  if (!_target) {
    const err = new Error('No version specified')
    err.userError = true
    throw err
  }

  const versionList = await kyso.lsVersions()
  const _version = versionList.find(d => (d.get('sha').slice(0, 6) === _target))

  if (!_version) {
    const err = new Error(
      `Version not found on this user account. Run ${chalk.dim('`kyso versions ls`')} to see your versions.`
    )
    err.userError = true
    throw err
  }

  let proceed
  try {
    const label = `Are you sure you want to delete this version?`
    proceed = await promptBool(label, { trailing: eraseLines(2) })
  } catch (err) {
    if (err.message === 'USER_ABORT') {
      proceed = false
    } else {
      throw err
    }
  }

  if (!proceed) {
    return false
  }

  const start = new Date()
  await kyso.rmVersion(_version)
  const elapsed = ms(new Date() - start)
  console.log(
    `${chalk.cyan('> Success!')} Version ${chalk.bold(_version.get('name'))} removed [${elapsed}]`
  )
  return true
}

const create = async (kyso, args) => {
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start = new Date()
  const message = String(args[0])
  const dir = process.cwd()
  const versionMade = await kyso.createVersion(message, dir)
  const elapsed = ms(new Date() - start)

  if (versionMade) {
    console.log(`${chalk.cyan('> Success!')} Version ${chalk.bold(chalk.underline(message))} created [${elapsed}]`)
  }
  return true
}

(async () => {
  try {
    const { args, argv, subcommand, token, apiUrl } = await getCommandArgs()

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

    if (subcommand === 'ls' || subcommand === 'list') {
      return await ls(kyso, args)
    }

    if (subcommand === 'rm' || subcommand === 'remove') {
      return await rm(kyso, args)
    }

    if (subcommand === 'create') {
      return await create(kyso, args)
    }

    error('Please specify a valid subcommand: ls | create | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
