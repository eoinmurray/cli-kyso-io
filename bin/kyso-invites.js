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
const Invites = require('../src/invites')
const exit = require('../src/utils/exit')
const info = require('../src/utils/output/info')

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'debug'],
  alias: {
    help: 'h',
    debug: 'd',
  }
})

const help = () => {
  console.log(
    `
  ${chalk.bold('kyso invites')} <ls | add | rm>

    ${chalk.gray('-')} Invite someone to a team you administer.

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Lists all your invites:
      ${chalk.cyan('$ kyso invites ls')}

  ${chalk.gray('–')} Invites someone to a team:
      ${chalk.cyan(`$ kyso invites add ${chalk.underline('user@email.com')} ${chalk.underline('my-team')}`)}

  ${chalk.gray('–')} Removing an invite:
      ${chalk.cyan(`$ kyso invites rm ${chalk.underline('user@email.com')}`)}
`
  )
}

async function run(token) {
  const invites = new Invites(apiUrl, token, { debug })
  const args = argv._.slice(1)

  switch (subcommand) {
    case 'ls':
    case 'list': {
      if (args.length !== 0) {
        error('Invalid number of arguments')
        return exit(1)
      }

      const start_ = new Date()
      const inviteList = await invites.ls()

      inviteList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const current = new Date()
      const header = [
        ['', 'to', 'team', 'created', 'accepted'].map(s => chalk.dim(s))
      ]

      let out = null
      if (inviteList.length !== 0) {
        out = table(header.concat(
            inviteList.map(t => {
              const time = chalk.gray(`${ms(current - new Date(t.createdAt))} ago`)
              return ['', t.get('targetEmail'), t.get('team').get('name'), time, t.get('accepted') ? 'yes' : 'no']
            })
          ), {
            align: ['l', 'l', 'l', 'l', 'l', 'l'],
            hsep: ' '.repeat(2),
            stringLength: strlen
          }
        )
      }
      const elapsed_ = ms(new Date() - start_)
      console.log(`> ${inviteList.length} invite${inviteList.length === 1 ? '' : 's'} found ${chalk.gray(`[${elapsed_}]`)}`)
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
        const err = new Error('No invite specified')
        err.userError = true
        throw err
      }

      const inviteList = await invites.ls()
      const _invite = findTeam(_target, inviteList)

      if (!_invite) {
        const err = new Error(`Team not found on this user account. Run ${chalk.dim('`now invites ls`')} to see your invites.`)
        err.userError = true
        throw err
      }

      try {
        const confirmation = await readConfirmation(_invite)
        if (confirmation !== _invite.get('name')) {
          console.log('\n> Aborted')
          process.exit(0)
        }

        const start = new Date()
        await invites.rm(_invite)
        const elapsed = ms(new Date() - start)
        console.log(
          `${chalk.cyan('> Success!')} Team ${chalk.bold(_invite.get('name'))} removed [${elapsed}]`
        )
      } catch (err) {
        error(err.message)
        exit(1)
      }

      break
    }

    case 'add': {
      if (args.length !== 2) {
        error('Invalid number of arguments')
        return exit(1)
      }

      const start = new Date()
      const targetEmail = String(args[0])
      const teamName = String(args[1])
      info(`> Adding ${chalk.bold(chalk.underline(targetEmail))} to ${chalk.bold(chalk.underline(teamName))}`)
      const invite = await invites.create(targetEmail, teamName)
      const elapsed = ms(new Date() - start)

      if (invite) {
        console.log(`${chalk.cyan('> Success!')} ${chalk.bold(chalk.underline(targetEmail))} invited to ${chalk.bold(chalk.underline(teamName))} [${elapsed}]`)
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

async function readConfirmation(_invite) {
  return new Promise(resolve => { // eslint-disable-line
    process.stdout.write(`> The invite "${_invite.get('name')}" will be removed permanently.\n`)
    process.stdout.write(`> Please note that deleting this invite will delete any and all repositories under the "${_invite.get('name')}" account.\n`)
    process.stdout.write('> Before proceeding, please be sure to review the Kyso Terms of Service regarding account deletion.\n')
    process.stdout.write(`\n  ${chalk.bold.red('> Enter this invite\'s name to confirm: ')}`)

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
        console.log(`> [debug] matched invite ${d.get('name')} by uid`)
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
          error(`Unknown error: ${err}\n${err.stack}`)
        }
        return exit(1)
      }
    })
    .catch(e => {
      if (e.userError) {
        error(e.message)
      } else {
        error(`Unknown error: ${e}\n${e.stack}`)
      }
      exit(1)
    })
}
