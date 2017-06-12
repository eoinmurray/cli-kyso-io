#!/usr/bin/env node
const ms = require('ms')
const chalk = require('chalk')
const login = require('../src/login')
const { error } = require('../src/error')
const getCommandArgs = require('../src/command-args');

(async () => {
  try {
    const start_ = new Date()
    const { argv, apiUrl } = await getCommandArgs()
    // await login({ debug: argv.debug, url: apiUrl })
    const elapsed_ = ms(new Date() - start_)
    console.log(`> Logged in successfully. Token saved in ${chalk.dim(`~/.kyso.json`)} ${chalk.gray(`[${elapsed_}]`)}`)
    return process.exit(0)
  } catch (er) {
    error(er.message)
    return process.exit(1)
  }
})()
