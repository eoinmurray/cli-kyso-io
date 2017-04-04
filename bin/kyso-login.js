#!/usr/bin/env node
const login = require('../src/login')
const { error } = require('../src/error');

login()
  .then(() => { // eslint-disable-line
    console.log('> Logged in successfully. Token saved in ~/.kyso.json')
    return process.exit(0)
  })
  .catch((er) => {
    error(er)
    process.exit(1)
  })
