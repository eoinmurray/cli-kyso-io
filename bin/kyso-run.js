#!/usr/bin/env node
const chalk = require('chalk')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const { handleError } = require('../src/error')
const Kyso = require('../src')
const exit = require('../src/utils/exit')

const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso run')}

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
`
  )
}


const run = async (cmd, args, apiUrl, token) => {
  const kyso = new Kyso(apiUrl, token)
  const start = new Date()

  const cmdArgs = joinArgs(args)
  await kyso.run(cmd, cmdArgs, args)
  const elapsed = ms(new Date() - start)
  console.log(`${chalk.cyan('> Success!')} Ran command ${chalk.bold(chalk.underline(cmd))} [${elapsed}]`)
  return true
}

const joinArgs = (args) => {
  if (!args.includes('--')) return ''
  let joinedArgs = ''
  args
    .slice(args.indexOf('--') + 1)
    .forEach(arg => {
      joinedArgs += ` "${arg.replace(/"/g, '\\"')}"`
    })
  return joinedArgs
}

(async () => {
  try {
    const { argv, token, apiUrl } = await getCommandArgs()
    const args = process.argv.slice(2)
    const cmd = args.shift()
    if (argv.help || !cmd) {
      help()
      return exit(0)
    }
    return await run(cmd, args, apiUrl, token)
  } catch (err) {
    return handleError(err)
  }
})()
