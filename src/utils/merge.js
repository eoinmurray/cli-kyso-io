const opn = require('opn')
const spawn = require('./spawn')
const { diff3Merge, diffComm } = require('./diff')

const mergeLines = (_base, _f1, _f2, srcMsg = '', trgtMsg = '') => {
  const base = _base.split('\n')
  const f1 = _f1.split('\n')
  const f2 = _f2.split('\n')
  let output = ""
  const results = diff3Merge(f1, base, f2, false)
  for (let i = 0; i < results.length; i += 1) {
    const item = results[i]
    if (item.ok) {
      output += item.ok.join('\n')
    } else {
      const c = diffComm(item.conflict.a, item.conflict.b)
      for (let j = 0; j < c.length; j += 1) {
        const inner = c[j]
        if (inner.common) {
          output += inner.common.join('\n')
        } else {
          output += `\n<<<<<<<<<< ${srcMsg}\n`
          output += inner.file1.join('\n')
          output += `\n========== ${trgtMsg}\n`
          output += inner.file2.join('\n')
          output += "\n>>>>>>>>>>\n"
        }
      }
    }
  }
  return output
}

const mergeJupyter = async (base, f1, f2, outFile, _cmd = 'nbdime merge') =>
  new Promise((resolve, reject) => { // eslint-disable-line
    const conf = {
      cwd: process.cwd(),
    }

    let sh = 'sh'
    let shFlag = '-c'
    if (process.platform === 'win32') {
      sh = process.env.comspec || 'cmd'
      shFlag = '/d /s /c'
      conf.windowsVerbatimArguments = true
    }

    const cmd = `${_cmd} "${base}" "${f1}" "${f2}"  --log-level DEBUG > "${outFile}"`

    const proc = spawn(sh, [shFlag, cmd], conf)

    const print = (data) => {
      if (data.includes('command not found')) return
      console.log(`${data}`)
      if (data.includes('URL:')) {
        const lines = data.toString().split('URL: ')
        opn(lines[1].replace('\n', ''))
      }
    }

    proc.stdout.on('data', print)
    proc.stderr.on('data', print)

    const procError = (er) => {
      process.removeListener('SIGTERM', procKill)
      process.removeListener('SIGTERM', procInterupt)
      process.removeListener('SIGINT', procKill)
      if (er.code === 'ENOENT') {
        const err = new Error(`nbdime 0.3.0 is needed to merge Jupyter notebooks. Run 'pip install nbdime==0.3.0' to install it.`)
        err.userError = true
        reject(err)
      }
      reject(er)
    }

    const procKill = () => {
      proc.kill()
    }

    const procInterupt = () => {
      proc.kill('SIGINT')
      proc.on('exit', () => {
        process.exit()
      })
      process.once('SIGINT', procKill)
    }

    proc.on('error', procError)
    proc.on('close', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        resolve()
      } else {
        resolve(code)
      }
    })

    process.once('SIGTERM', procKill)
    process.once('SIGINT', procInterupt)
  })

const mergeJupyterWeb = async (base, f1, f2, _cmd = 'nbdime merge-web') =>
  new Promise((resolve, reject) => { // eslint-disable-line
    const conf = {
      cwd: process.cwd(),
    }

    let sh = 'sh'
    let shFlag = '-c'
    if (process.platform === 'win32') {
      sh = process.env.comspec || 'cmd'
      shFlag = '/d /s /c'
      conf.windowsVerbatimArguments = true
    }

    const cmd = `${_cmd} "${base}" "${f1}" "${f2}"`

    const proc = spawn(sh, [shFlag, cmd], conf)

    const print = (data) => {
      if (data.includes('command not found')) return
      console.log(`${data}`)
      if (data.includes('URL:')) {
        const lines = data.toString().split('URL: ')
        opn(lines[1].replace('\n', ''))
      }
    }

    proc.stdout.on('data', print)
    proc.stderr.on('data', print)

    const procError = (er) => {
      process.removeListener('SIGTERM', procKill)
      process.removeListener('SIGTERM', procInterupt)
      process.removeListener('SIGINT', procKill)
      if (er.code === 'ENOENT') {
        const err = new Error(`nbdime 0.3.0 is needed to merge Jupyter notebooks. Run 'pip install nbdime==0.3.0' to install it.`)
        err.userError = true
        reject(err)
      }
      reject(er)
    }

    const procKill = () => {
      proc.kill()
    }

    const procInterupt = () => {
      proc.kill('SIGINT')
      proc.on('exit', () => {
        process.exit()
      })
      process.once('SIGINT', procKill)
    }

    proc.on('error', procError)
    proc.on('close', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        resolve()
      } else {
        resolve(code)
      }
    })

    process.once('SIGTERM', procKill)
    process.once('SIGINT', procInterupt)
  })


const diffJupyter = async (base, f1, _cmd = 'nbdime diff') =>
  new Promise((resolve, reject) => { // eslint-disable-line
    const conf = {
      cwd: process.cwd(),
    }

    let sh = 'sh'
    let shFlag = '-c'
    if (process.platform === 'win32') {
      sh = process.env.comspec || 'cmd'
      shFlag = '/d /s /c'
      conf.windowsVerbatimArguments = true
    }

    const cmd = `${_cmd} "${base}" "${f1}"`

    const proc = spawn(sh, [shFlag, cmd], conf)

    const parseUrl = (data) => {
      if (data.includes('command not found')) return
      console.log(`${data}`)
      if (data.includes('URL:')) {
        const lines = data.toString().split('URL: ')
        opn(lines[1].replace('\n', ''))
      }
    }

    proc.stdout.on('data', parseUrl)
    proc.stderr.on('data', parseUrl)

    const procError = (er) => {
      process.removeListener('SIGTERM', procKill)
      process.removeListener('SIGTERM', procInterupt)
      process.removeListener('SIGINT', procKill)
      if (er.code === 'ENOENT') {
        const err = new Error(`nbdime 0.3.0 is needed to merge Jupyter notebooks. Run 'pip install nbdime==0.3.0' to install it.`)
        err.userError = true
        reject(err)
      }
      reject(er)
    }

    const procKill = () => {
      proc.kill()
    }

    const procInterupt = () => {
      proc.kill('SIGINT')
      proc.on('exit', () => {
        process.exit()
      })
      process.once('SIGINT', procKill)
    }

    proc.on('error', procError)
    proc.on('close', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        resolve()
      } else {
        resolve(code)
      }
    })

    process.once('SIGTERM', procKill)
    process.once('SIGINT', procInterupt)
  })

module.exports = {
  mergeLines,
  mergeJupyter,
  mergeJupyterWeb,
  diffJupyter
}
