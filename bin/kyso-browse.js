#!/usr/bin/env node
const exit = require('../src/utils/exit')
const getCommandArgs = require('../src/command-args')
const { handleError } = require('../src/error')
const Kyso = require('../src')
const opn = require('opn')

const browse = async (kyso) => {
  opn(`https://kyso.io/${kyso.pkg.author}/${kyso.pkg.name}`)
}


(async () => {
  try {
    const { argv, token, apiUrl } = await getCommandArgs()

    const kyso = new Kyso({
      url: apiUrl,
      token,
      debug: argv.debug,
      dir: process.cwd()
    })

    browse(kyso)
    return exit(0)
  } catch (err) {
    return handleError(err)
  }
})()
