#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const strlen = require('../src/strlen')
const { error, handleError } = require('../src/error')
const Kyso = require('../src')
const exit = require('../src/utils/exit')

const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso studies')} <ls | create | rm> <studyname>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Lists all your studies:
      ${chalk.cyan('$ kyso studies ls')}

  ${chalk.gray('–')} Creates a study:
      ${chalk.cyan(`$ kyso studies create ${chalk.underline('my-study-name')}`)}

  ${chalk.gray('–')} Removing a study:
      ${chalk.cyan('$ kyso studies rm my-study-name')}
`
  )
}

const ls = async (args, apiUrl, token) => {
  const kyso = new Kyso(apiUrl, token)
  if (args.length !== 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start_ = new Date()
  const studyList = await kyso.lsStudies()
  studyList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const current = new Date()
  const header = [
    ['', 'name', 'created'].map(s => chalk.dim(s))
  ]

  let out = null
  if (studyList.length !== 0) {
    out = table(header.concat(
        studyList.map(t => {
          const time = chalk.gray(`${ms(current - new Date(t.createdAt))} ago`)
          return ['', t.get('name'), time]
        })
      ), {
        align: ['l', 'r', 'l', 'l', 'l', 'l'],
        hsep: ' '.repeat(2),
        stringLength: strlen
      }
    )
  }

  const elapsed_ = ms(new Date() - start_)
  console.log(`> ${studyList.length} study${studyList.length === 1 ? '' : 's'} found ${chalk.gray(`[${elapsed_}]`)}`)
  if (out) { console.log(`\n${out}\n`) }
  return true
}

const rm = async (args, apiUrl, token) => {
  const kyso = new Kyso(apiUrl, token)
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const _target = String(args[0])
  if (!_target) {
    const err = new Error('No study specified')
    err.userError = true
    throw err
  }

  const studyList = await kyso.lsStudies()
  const _study = studyList.find(d => (d.get('name') === _target))

  if (!_study) {
    const err = new Error(
      `Study not found on this user account. Run ${chalk.dim('`kyso studies ls`')} to see your studies.`
    )
    err.userError = true
    throw err
  }

  const confirmation = await readConfirmation(_study)
  if (confirmation !== _study.get('name')) {
    console.log('\n> Aborted')
    process.exit(0)
  }

  const start = new Date()
  await kyso.rmStudy(_study)
  const elapsed = ms(new Date() - start)
  console.log(
    `${chalk.cyan('> Success!')} Study ${chalk.bold(_study.get('name'))} removed [${elapsed}]`
  )
  return true
}

const create = async (args, apiUrl, token) => {
  const kyso = new Kyso(apiUrl, token)
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start = new Date()
  const name = String(args[0])
  const dir = process.cwd()
  const studyMade = await kyso.createStudy(name, dir)
  const elapsed = ms(new Date() - start)

  if (studyMade) {
    console.log(`${chalk.cyan('> Success!')} Study ${chalk.bold(chalk.underline(name))} created [${elapsed}]`)
  }
  return true
}

const readConfirmation = async (_study) =>
  new Promise(resolve => { // eslint-disable-line
    process.stdout.write(`> The study "${_study.get('name')}" will be removed permanently.\n`)
    process.stdout.write(`\n  ${chalk.bold.red('> Enter this study\'s name to confirm: ')}`)

    process.stdin
      .on('data', d => {
        process.stdin.pause()
        resolve(d.toString().trim())
      })
      .resume()
  });


(async () => {
  try {
    const { args, argv, subcommand, token, apiUrl } = await getCommandArgs()

    if (argv.help || !subcommand) {
      help()
      return exit(0)
    }

    if (subcommand === 'ls' || subcommand === 'list') {
      return await ls(args, apiUrl, token)
    }

    if (subcommand === 'rm' || subcommand === 'remove') {
      return await rm(args, apiUrl, token)
    }

    if (subcommand === 'create') {
      return await create(args, apiUrl, token)
    }

    error('Please specify a valid subcommand: ls | create | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
