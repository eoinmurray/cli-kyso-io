/* eslint-disable unicorn/no-process-exit */

// Native
import fs from 'fs'
import path from 'path'

// Packages
import onDeath from 'death'
import fetch from 'node-fetch'

// Utilities
import plusxSync from './chmod'
import { disableProgress, enableProgress, info, showProgress, warn } from './log'

const kyso = path.join(__dirname, 'kyso')
const targetWin32 = path.join(__dirname, 'kyso.exe')
const target = process.platform === 'win32' ? targetWin32 : kyso
const partial = `${target}.partial`

const packagePath = path.join(__dirname, '../../package.json')
const packageJSON = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

const platformToName = {
  darwin: 'kyso-macos',
  linux: 'kyso-linux',
  win32: 'kyso-win.exe'
}

async function main() {
  try {
    fs.writeFileSync(
      kyso,
      '#!/usr/bin/env node\n' +
        'console.log("Please wait until the \'kyso\' installation completes!")\n'
    )
  } catch (err) {
    if (err.code === 'EACCES') {
      warn('Please try installing kyso CLI again with the `--unsafe-perm` option.')
      info('Example: `npm i -g --unsafe-perm kyso`')

      process.exit()
    }

    throw err
  }

  onDeath(() => {
    fs.writeFileSync(
      kyso,
      '#!/usr/bin/env node\n' +
        'console.log("The \'kyso\' installation did not complete successfully.")\n' +
        'console.log("Please run \'npm i -g kyso\' to reinstall!")\n'
    )
    process.exit()
  })

  info('For the source code, check out: https://github.com/eoinmurray/cli-kyso-io')

  // Print an empty line
  console.log('')

  enableProgress(`Downloading kyso CLI ${packageJSON.version}`)
  showProgress(0)

  const name = platformToName[process.platform]
  const url = `https://github.com/eoinmurray/cli-kyso-io/releases/download/${packageJSON.version}/${name}`
  const resp = await fetch(url)

  if (resp.status !== 200) {
    disableProgress()
    throw new Error(`${resp.statusText} ${url}`)
  }

  const size = resp.headers.get('content-length')
  const ws = fs.createWriteStream(partial)

  await new Promise((resolve, reject) => { // eslint-disable-line
    let bytesRead = 0

    resp.body.on('data', chunk => {
      bytesRead += chunk.length
      showProgress(100 * bytesRead / size) // eslint-disable-line
    }).on('error', error => {
      disableProgress()
      reject(error)
    })

    resp.body.pipe(ws)

    ws.on('close', () => {
      showProgress(100)
      disableProgress()
      resolve()
    }).on('error', error => {
      disableProgress()
      reject(error)
    })
  })

  fs.renameSync(partial, target)

  if (process.platform === 'win32') {
    fs.writeFileSync(
      kyso,
      '#!/usr/bin/env node\n' +
        'var chip = require("child_process")\n' +
        'var args = process.argv.slice(2)\n' +
        'var opts = { stdio: "inherit" }\n' +
        'var r = chip.spawnSync(__dirname + "/kyso.exe", args, opts)\n' +
        'if (r.error) throw r.error\n' +
        'process.exit(r.status)\n'
    )
  } else {
    plusxSync(kyso)
  }
}

main().catch(err => { // eslint-disable-line
  console.error(err)
  process.exit(2)
})
