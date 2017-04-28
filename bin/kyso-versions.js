#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const { eraseLines } = require('ansi-escapes')
const promptBool = require('../src/utils/input/prompt-bool')
const getCommandArgs = require('../src/command-args')
const { error, handleError } = require('../src/error')
const strlen = require('../src/strlen')
const Kyso = require('../src')
const exit = require('../src/utils/exit')
const wait = require('../src/utils/output/wait')

const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso versions')} <ls | create | rm | status>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} List all versions of the current study:
      ${chalk.cyan('$ kyso versions ls')}

  ${chalk.gray('–')} List all versions of a named study:
      ${chalk.cyan('$ kyso versions ls my-study')}

  ${chalk.gray('–')} Create a version:
      ${chalk.cyan(`$ kyso versions create ${chalk.underline('"a commit message"')}`)}

  ${chalk.gray('–')} Remove a version:
      ${chalk.cyan('$ kyso versions rm <version-sha>')}

  ${chalk.gray('–')} List current version and file changes:
      ${chalk.cyan('$ kyso versions status')}
`
  )
}


const status = async (kyso) => {
  const start = new Date()
  const dir = process.cwd()

  const {
    version,
    isDirty,
    added,
    currentSha,
    removed,
    unchanged,
    modified
  } = await kyso.currentVersion(dir)

  if (isDirty) {
    let out = null
    const opts = { align: ['l', 'l', 'l'], hsep: ' '.repeat(1), stringLength: strlen }
    let all = []
    if (added.length !== 0) {
      all = all.concat([['', chalk.dim('> Added'), '', '']], added.map(d => ['', '', d.name, d.sha]))
    }
    if (removed.length !== 0) {
      all = all.concat([['', chalk.dim('> Removed'), '', '']], removed.map(d => ['', '', d.name, d.sha]))
    }
    if (unchanged.length !== 0) {
      all = all.concat([['', chalk.dim('> Unchanged'), '', '']], unchanged.map(d => ['', '', d.name, d.sha]))
    }
    if (modified.length !== 0) {
      all = all.concat([['', chalk.dim('> Modified'), '', '']], modified.map(d => ['', '', d.name, d.sha]))
    }

    out = table(all, opts)
    console.log(`\n${out}\n`)
  }

  const elapsed = ms(new Date() - start)

  if (isDirty) {
    console.log(`Last version was ${chalk.bold(version.get('sha'))} but files have changed.`)
    console.log(`Current hash is  ${chalk.bold(currentSha)} [${elapsed}]`)
  } else {
    console.log(`Current version is ${chalk.underline(version.get('sha'))}. No changes [${elapsed}]`)
  }
}


const ls = async (kyso, args) => {
  let studyName = null
  if (args.length === 1) {
    studyName = String(args[0])
    if (studyName.includes('/')) {
      studyName = studyName.split('/')[1]
    }
  }

  const start_ = new Date()
  const st = wait(`Fetching versions`)
  const versionList = await kyso.lsVersions({ studyName })
  st()
  const { version: currentVersion, isDirty } = await kyso.currentVersion(process.cwd())

  versionList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const current = new Date()
  const header = [
    ['current', 'created', 'version (6-digits)', 'message'].map(s => chalk.dim(s))
  ]

  let out = null
  if (versionList.length !== 0) {
    out = table(header.concat(
        versionList.map(t => {
          const time = chalk.gray(`${ms(current - new Date(t.createdAt))} ago`)

          let star = ''
          if (currentVersion && t.get('sha') === currentVersion.get('sha') && !isDirty) {
            star = '✔'
          }

          return [star, time, t.get('sha').slice(0, 6), t.get('message')]
        })
      ), {
        align: ['r', 'l', 'l', 'l', 'l', 'l'],
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

  const st = wait(`Fetching version`)
  const versionList = await kyso.lsVersions()
  st()
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
    `${chalk.cyan('> Success!')} Version ${chalk.bold(_version.get('sha').slice(0, 6))} removed [${elapsed}]`
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
  try {
    const versionMade = await kyso.createVersion(message, dir)
    const elapsed = ms(new Date() - start)
    if (versionMade) {
      console.log(`${chalk.cyan('> Success!')} Version ${chalk.bold(chalk.underline(message))} created [${elapsed}]`)
    }
    return true
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`${chalk.red('> Error! Couldn\'t run pre or post version hook. Check the "scripts" field of study.json')}`)
      return false
    }
    throw err
  }
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

    if (subcommand === 'status') {
      return await status(kyso)
    }

    error('Please specify a valid subcommand: ls | create | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
