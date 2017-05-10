#!/usr/bin/env node
const { resolve } = require('path')
const nodeVersion = require('node-version')
const updateNotifier = require('update-notifier')
const chalk = require('chalk')
const pkg = require('../src/pkg')

// Throw an error if node version is too low
if (nodeVersion.major < 6) {
  console.error('Kyso requires at least version 6 of Node. Please upgrade!')
  process.exit(1)
}

if (!process.pkg) {
  const notifier = updateNotifier({ pkg })
  const update = notifier.update

  if (update) {
    let message = `Update available! ${chalk.red(update.current)} → ${chalk.green(update.latest)} \n`
    message += `Run ${chalk.magenta('npm i -g kyso')} to update!\n`
    message += `${chalk.magenta('Changelog:')} https://github.com/kyso/kyso-cli/releases/tag/${update.latest}`

    notifier.notify({ message })
  }
}

// This command will be run if no other sub command is specified
const defaultCommand = 'help'

const commands = new Set([
  defaultCommand,
  'help',
  'login',
  'studies',
  'versions',
  'teams',
  'invites',
  'tags',
  'run',
  'docs',
  'browse',
  'clone',
  'checkout',
  'merge',
  'docker',

  // must list aliases too
  'create',
  'push',
  'list',
  'status'
])

// here we can define aliases for the commands
// ie 'ls' would match 'list'
const aliases = new Map([
  ['create', 'studies create'],
  ['push', 'versions create'],
  ['list', 'versions ls'],
  ['status', 'versions status'],
])

// use at least the defaultCommand, which is help
let command = defaultCommand

// user given arguments
const args = process.argv.slice(2)

// find where in the list of commands is this argument
const index = args.findIndex(a => commands.has(a))

// if the command exists
if (index > -1) {
  command = args[index]
  args.splice(index, 1)

  if (command === 'help') {
    if (index < args.length && commands.has(args[index])) {
      command = args[index]
      args.splice(index, 1)
    } else {
      command = defaultCommand
    }

    args.unshift('--help')
  }

  let alias = aliases.get(command)

  // if the alias has both a command and subcommand
  // ie 'create': 'studies create'
  if (alias && alias.split(' ').length > 1) {
    // we add the subcommand to the args
    args.splice(0, 0, alias.split(' ')[1])
    // and set the alias to the command
    alias = alias.split(' ')[0]
  }
  command = alias || command
}

// find the command file in the bin folder
const bin = resolve(__dirname, `kyso-${command}.js`)

// Prepare process.argv for subcommand
process.argv = process.argv.slice(0, 2).concat(args)

// Load sub command
// With custom parameter to make "pkg" happy
require(bin, 'may-exclude') //eslint-disable-line
