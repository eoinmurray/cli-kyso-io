#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const strlen = require('../src/strlen')
const { error, handleError } = require('../src/error')
const Kyso = require('../src')
const exit = require('../src/utils/exit')
const wait = require('../src/utils/output/wait')
const getCommandArgs = require('../src/command-args')
const opn = require('opn')

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso teams')} <ls | create | rm> <teamname>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} List all your teams:
      ${chalk.cyan('$ kyso teams ls')}

  ${chalk.gray('–')} Create a team:
      ${chalk.cyan(`$ kyso teams create `)}
        ${chalk.dim('It will open the create team page on Kyso')}

  ${chalk.gray('–')} Remove a team:
      Please contact us on laura@kyso.io
`
  )
}

const ls = async (kyso, args) => {
  if (args.length !== 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start_ = new Date()
  const st = wait(`Fetching your teams`)
  const teamList = await kyso.lsTeams()
  st()
  teamList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const current = new Date()
  const header = [
    ['', 'name', 'created'].map(s => chalk.dim(s))
  ]

  let out = null
  if (teamList.length !== 0) {
    out = table(header.concat(
        teamList.map(t => {
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
  console.log(`> ${teamList.length} team${teamList.length === 1 ? '' : 's'} found ${chalk.gray(`[${elapsed_}]`)}`)
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
    const err = new Error('No team specified')
    err.userError = true
    throw err
  }

  const st = wait(`Fetching team`)
  const teamList = await kyso.lsTeams()
  st()
  const _team = teamList.find(d => d.get('name') === _target)

  if (!_team) {
    const err = new Error(
      `Team not found on this user account. Run ${chalk.dim('`now teams ls`')} to see your teams.`
    )
    err.userError = true
    throw err
  }

  const confirmation = await readConfirmation(_team)
  if (confirmation !== _team.get('name')) {
    console.log('\n> Aborted')
    process.exit(0)
  }

  const start = new Date()
  await kyso.rmTeam(_team)
  const elapsed = ms(new Date() - start)
  console.log(`${chalk.cyan('> Success!')} Team ${chalk.bold(_team.get('name'))} removed [${elapsed}]`)
  return true
}

const create = async () => {
  opn(`https://kyso.io/teams/create`)
  process.exit(1)
}


async function readConfirmation(_team) {
  return new Promise(resolve => { // eslint-disable-line
    process.stdout.write(`> The team "${_team.get('name')}" will be removed permanently.\n`)
    process.stdout.write(`> Please note that deleting this team will delete any and all repositories under the "${_team.get('name')}" account.\n`)
    process.stdout.write('> Before proceeding, please be sure to review the Kyso Terms of Service regarding account deletion.\n')
    process.stdout.write(`\n  ${chalk.bold.red('> Enter this team\'s name to confirm: ')}`)

    process.stdin
      .on('data', d => {
        process.stdin.pause()
        resolve(d.toString().trim())
      })
      .resume()
  })
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

    // if (subcommand === 'rm' || subcommand === 'remove') {
    //   return await rm(kyso, args)
    // }

    if (subcommand === 'create') {
      return await create(kyso, args)
    }

    error('Please specify a valid subcommand: ls | create | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
