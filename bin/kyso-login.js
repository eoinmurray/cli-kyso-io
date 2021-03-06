#!/usr/bin/env node
const ms = require('ms')
const chalk = require('chalk')
const { error } = require('../src/error')
const getCommandArgs = require('../src/command-args')
const login = require('../src/login');

(async () => {
  try {
    const start_ = new Date()
    const { apiUrl, argv } = await getCommandArgs({ noLogin: true })
    const token = await login({ debug: argv.debug, url: apiUrl })
    const elapsed_ = ms(new Date() - start_)

    if (token) {
      console.log(`> Logged in successfully. Token saved in ${chalk.dim(`~/.kyso.json`)} ${chalk.gray(`[${elapsed_}]`)}`)
    }

    return process.exit(0)
  } catch (er) {
    error(er.message)
    return process.exit(1)
  }
})()
