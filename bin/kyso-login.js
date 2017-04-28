#!/usr/bin/env node
const ms = require('ms')
const chalk = require('chalk')
const login = require('../src/login')
const { error } = require('../src/error');

const start_ = new Date()

login()
  .then(() => { // eslint-disable-line
    const elapsed_ = ms(new Date() - start_)
    console.log(`> Logged in successfully. Token saved in ${chalk.dim(`~/.kyso.json`)} ${chalk.gray(`[${elapsed_}]`)}`)
    return process.exit(0)
  })
  .catch((er) => {
    error(er)
    process.exit(1)
  })
