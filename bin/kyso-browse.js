#!/usr/bin/env node
const exit = require('../src/utils/exit')
const getCommandArgs = require('../src/command-args')
const { handleError } = require('../src/error')
const Kyso = require('../src')
const opn = require('opn')

const browse = async (kyso, debug) => {
  const url = debug ? 'http://localhost:3000' : 'https://kyso.io'

  console.log(`Opening '${url}/${kyso.pkg.author}/${kyso.pkg.name}'`)
  await opn(`${url}/${kyso.pkg.author}/${kyso.pkg.name}`)
  return exit(0)
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

    browse(kyso, argv.debug)
    return exit(0)
  } catch (err) {
    return handleError(err)
  }
})()
