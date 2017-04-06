#!/usr/bin/env node
const chalk = require('chalk')
const minimist = require('minimist')
const table = require('text-table')
const ms = require('ms')

// Ours
const login = require('../src/login')
const cfg = require('../src/cfg')
const strlen = require('../src/strlen')
const { error } = require('../src/error')
const Teams = require('../src/teams')
const exit = require('../src/utils/exit')

const argv = minimist(process.argv.slice(2), {
  string: ['config', 'token'],
  boolean: ['help', 'debug', 'external', 'force'],
  alias: {
    help: 'h',
    config: 'c',
    debug: 'd',
    external: 'e',
    force: 'f',
    token: 't',
  },
})

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso teams')} <ls | create | rm> <teamname>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Lists all your teams:
      ${chalk.cyan('$ kyso teams ls')}

  ${chalk.gray('–')} Creates a team:
      ${chalk.cyan(`$ kyso teams create ${chalk.underline('my-team-name')}`)}

  ${chalk.gray('–')} Removing a team:
      ${chalk.cyan('$ kyso teams rm my-team-name')}
`
  )
}

async function run(token) {
  const teams = new Teams(apiUrl, token, { debug })
  const args = argv._.slice(1)

  switch (subcommand) {
    case 'ls':
    case 'list': {
      if (args.length !== 0) {
        error('Invalid number of arguments')
        return exit(1)
      }

      const start_ = new Date()
      const teamList = await teams.ls()
      teamList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      // return console.log(teamList)
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
      break
    }

    case 'rm':
    case 'remove': {
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

      const teamList = await teams.ls()
      const _team = findTeam(_target, teamList)

      if (!_team) {
        const err = new Error(
          `Team not found on this user account. Run ${chalk.dim('`now teams ls`')} to see your teams.`
        )
        err.userError = true
        throw err
      }

      try {
        const confirmation = await readConfirmation(_team)
        if (confirmation !== _team.get('name')) {
          console.log('\n> Aborted')
          process.exit(0)
        }

        const start = new Date()
        await teams.rm(_team)
        const elapsed = ms(new Date() - start)
        console.log(
          `${chalk.cyan('> Success!')} Team ${chalk.bold(_team.get('name'))} removed [${elapsed}]`
        )
      } catch (err) {
        error(err.message)
        exit(1)
      }

      break
    }

    case 'create': {
      if (args.length !== 1) {
        error('Invalid number of arguments')
        return exit(1)
      }

      const start = new Date()
      const name = String(args[0])
      const team = await teams.create(name)
      const elapsed = ms(new Date() - start)

      if (team) {
        console.log(`${chalk.cyan('> Success!')} Team ${chalk.bold(chalk.underline(name))} created [${elapsed}]`)
      }
      break
    }
    default:
      error('Please specify a valid subcommand: ls | create | rm')
      help()
      exit(1)
  }
  return 1
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

function findTeam(val, list) {
  return list.find(d => {
    if (d.get('name') === val) {
      if (debug) {
        console.log(`> [debug] matched team ${d.get('name')} by uid`)
      }
      return true
    }
    return false
  })
}


const subcommand = argv._[0]
const debug = argv.debug
const apiUrl = argv.url || 'https://api.kyso.io'

if (argv.help || !subcommand) {
  help() // eslint-disable-line
  exit(0)
} else {
  const config = cfg.read()

  Promise.resolve(config.token || login())
    .then(async token => { // eslint-disable-line
      try {
        return run(token) // eslint-disable-line
      } catch (err) {
        if (err.userError) {
          error(err.message)
        } else {
          error(`Unknown error: ${err.message}\n${err.stack || ''}`)
        }
        return exit(1)
      }
    })
    .catch(e => {
      error(`${e.message}`)
      exit(1)
    })
}
