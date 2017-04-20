#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const strlen = require('../src/strlen')
const { error, handleError } = require('../src/error')
const Kyso = require('../src')
const exit = require('../src/utils/exit')


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

const ls = async (kyso, args) => {
  if (args.length !== 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start_ = new Date()
  const inviteList = await kyso.lsInvites()

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
  return true
}

const rm = async (kyso, args) => {
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

  const inviteList = await kyso.lsInvites()
  const _invite = inviteList.find(d => (d.get('name') === _target))

  if (!_invite) {
    const err = new Error(`Team not found on this user account. Run ${chalk.dim('`now invites ls`')} to see your invites.`)
    err.userError = true
    throw err
  }


  const confirmation = await readConfirmation(_invite)
  if (confirmation !== _invite.get('name')) {
    console.log('\n> Aborted')
    process.exit(0)
  }

  const start = new Date()
  await kyso.rmInvite(_invite)
  const elapsed = ms(new Date() - start)
  console.log(`${chalk.cyan('> Success!')} Team ${chalk.bold(_invite.get('name'))} removed [${elapsed}]`)
  return true
}

const add = async (kyso, args) => {
  if (args.length !== 2) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start = new Date()
  const targetEmail = String(args[0])
  const teamName = String(args[1])
  console.log(`Adding ${chalk.bold(chalk.underline(targetEmail))} to ${chalk.bold(chalk.underline(teamName))}`)
  const invite = await kyso.createInvite(targetEmail, teamName)
  const elapsed = ms(new Date() - start)

  if (invite) {
    console.log(`${chalk.cyan('> Success!')} ${chalk.bold(chalk.underline(targetEmail))} invited to ${chalk.bold(chalk.underline(teamName))} [${elapsed}]`)
  }
  return true
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

    if (subcommand === 'add') {
      return await add(kyso, args)
    }

    error('Please specify a valid subcommand: ls | add | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
