#!/usr/bin/env node
const exit = require('../src/utils/exit')
const { handleError } = require('../src/error')
const opn = require('opn')

const openDocs = () => {
  opn(`https://kyso.io/docs`)
}

(async () => {
  try {
    openDocs()
    return exit(0)
  } catch (err) {
    return handleError(err)
  }
})()
