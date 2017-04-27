#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const { error, handleError } = require('../src/error')
const strlen = require('../src/strlen')
const exit = require('../src/utils/exit')
const Kyso = require('../src')


const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso merge')}

  ${chalk.dim('Options:')}
    -h, --help              Output usage information

  To merge Jupyter notebooks you will need to first install 'nbdime'

    ${chalk.underline(`pip install nbdime`)}

  ${chalk.dim('To merge a fork:')}

    ${chalk.gray(`1.`)} ${chalk.cyan(`$ kyso merge pull ${chalk.underline(`username/forked-study#version-sha`)}`)}

      Pull the merge. This will create a .merge folder with the merge content.
      If the version-sha is not given, the latest will be pulled.

    ${chalk.gray(`2.`)} ${chalk.cyan(`$ kyso merge ls`)}

      This will list all the potential conflicts in the merge

    ${chalk.gray(`3.`)} ${chalk.cyan(`$ kyso merge apply`)}

      This will do a 3-way merge of all files (including intelligent merging of Jupyter notebooks)

    ${chalk.gray(`4.`)} ${chalk.cyan(`$ kyso merge ls`)}

      This will list the actual conflicts resulting from the merge
`
  )
}

const pullMerge = async (kyso, args) => {
  if (args.length === 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const name = String(args[0])

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

  const dest = process.cwd()
  const start_ = new Date()

  await kyso.pullMerge(studyName, teamName, dest, { versionSha })
  const elapsed_ = ms(new Date() - start_)
  console.log(`> Downloaded merge to .merge/ ${chalk.gray(`[${elapsed_}]`)}`)
  return true
}

const ls = async (kyso) => {
  const start_ = new Date()

  const dest = process.cwd()
  const conflicts = await kyso.lsConflicts(dest)
  const elapsed_ = ms(new Date() - start_)
  const header = [['', 'conflicted files'].map(s => chalk.dim(s))]
  let out = null
  if (conflicts && conflicts.length !== 0) {
    out = table(header.concat(
      conflicts.map(t => ['', `${t.name}`])
      ), {
        align: ['l', 'l', 'l', 'l', 'l', 'l'],
        hsep: ' '.repeat(2),
        stringLength: strlen
      }
    )
  }

  console.log(`> Merged ${chalk.gray(`[${elapsed_}]`)}`)
  if (out) { console.log(`\n${out}\n`) }
  return true
}


const applyMerge = async (kyso) => {
  const start_ = new Date()
  const conflicts = await kyso.applyMerge()
  const elapsed_ = ms(new Date() - start_)
  const header = [['', 'conflicted files'].map(s => chalk.dim(s))]
  let out = null
  if (conflicts && conflicts.length !== 0) {
    out = table(header.concat(
      conflicts.map(t => ['', `${t.name}`])
      ), {
        align: ['l', 'l', 'l', 'l', 'l', 'l'],
        hsep: ' '.repeat(2),
        stringLength: strlen
      }
    )
  }

  console.log(`> Applied merge ${chalk.gray(`[${elapsed_}]`)}`)
  if (out) { console.log(`\n${out}\n`) }
  return true
}


const nbResolve = async (kyso, args) => {
  const start_ = new Date()
  const file = String(args[0])
  await kyso.nbResolve(file)
  const elapsed_ = ms(new Date() - start_)
  console.log(`> Resolved ${chalk.gray(`[${elapsed_}]`)}`)
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

    if (subcommand === 'nb' || subcommand === 'nbresolve') {
      return await nbResolve(kyso, args)
    }

    if (subcommand === 'pull') {
      return await pullMerge(kyso, args)
    }

    if (subcommand === 'apply') {
      return await applyMerge(kyso)
    }

    // return await merge(kyso, [subcommand].concat(args))
    // error('Please specify a valid subcommand: ls | create | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
