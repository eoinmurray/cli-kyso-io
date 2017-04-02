#!/usr/bin/env node

// Native
const { resolve } = require('path')

// Ours
const login = require('../src/login')
const { error } = require('../src/error');

login()
  .then(token => {
    console.log('> Logged in successfully. Token saved in ~/.kyso.json')
    process.exit(0)
  })
  .catch((error) => {
    // error(`Authentication error`)
    console.error(error)
    process.exit(1)
  })
