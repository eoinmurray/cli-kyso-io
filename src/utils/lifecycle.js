const path = require('path')
const fs = require('fs-promise')
const uidNumber = require('uid-number')
const which = require('which')
const spawn = require('./spawn')

let PATH = 'PATH'

// windows calls it's path 'Path' usually, but this is not guaranteed.
if (process.platform === 'win32') {
  PATH = 'Path'
  Object.keys(process.env).forEach((e) => {
    if (e.match(/^PATH$/i)) {
      PATH = e
    }
  })
}

const logid = (pkg, cmd) => `${pkg.name}~${cmd}:`

const _incorrectWorkingDirectory = (wd, pkg) =>
  wd.lastIndexOf(pkg.name) !== wd.length - pkg.name.length

const lifecycle = async (pkg, cmd, _wd, unsafe) => {
  const wd = await validWd(_wd)
  // set the env variables, then run scripts as a child process.
  const env = await makeEnv(pkg)
  env.kyso_lifecycle_event = cmd
  env.kyso_node_execpath = env.NODE = env.NODE || process.execPath // eslint-disable-line
  env.kyso_execpath = require.main.filename
  return lifecycle_(pkg, cmd, wd, env, unsafe)
}

const lifecycle_ = async (pkg, cmd, wd, env, unsafe) => {
  const pathArr = []
  const p = wd.split(/[\\\/]node_modules[\\\/]/) // eslint-disable-line
  let acc = path.resolve(p.shift())

  p.forEach((pp) => {
    pathArr.unshift(path.join(acc, 'node_modules', '.bin'))
    acc = path.join(acc, 'node_modules', pp)
  })
  pathArr.unshift(path.join(acc, 'node_modules', '.bin'))

  // we also unshift the bundled node-gyp-bin folder so that
  // the bundled one will be used for installing things.
  pathArr.unshift(path.join(__dirname, '..', '..', 'bin', 'node-gyp-bin'))

  if (shouldPrependCurrentNodeDirToPATH()) {
    // prefer current node interpreter in child scripts
    pathArr.push(path.dirname(process.execPath))
  }

  if (env[PATH]) pathArr.push(env[PATH])
  env[PATH] = pathArr.join(process.platform === 'win32' ? ';' : ':') // eslint-disable-line

  const packageLifecycle = pkg.scripts && pkg.scripts.hasOwnProperty(cmd) // eslint-disable-line
  if (packageLifecycle) {
    // define this here so it's available to all scripts.
    env.kyso_lifecycle_script = pkg.scripts[cmd] // eslint-disable-line
  } else {
    console.log('lifecycle', logid(pkg, cmd), `no script for ${cmd}, continuing`)
  }

  if (packageLifecycle) {
    return runPackageLifecycle(pkg, env, wd, unsafe)
    // await runHookLifecycle(pkg, env, wd, unsafe)
  }
  return false
}

const shouldPrependCurrentNodeDirToPATH = () => {
  let isDifferentNodeInPath
  let foundExecPath
  const isWindows = process.platform === 'win32'
  try {
    foundExecPath = which
      .sync(path.basename(process.execPath), { pathExt: isWindows ? ';' : ':' })
      // Apply `fs.realpath()` here to avoid false positives when `node` is a symlinked executable.
    isDifferentNodeInPath = fs.realpathSync(process.execPath).toUpperCase() !==
        fs.realpathSync(foundExecPath).toUpperCase()
  } catch (e) {
    isDifferentNodeInPath = true
  }
  return isDifferentNodeInPath
}

const validWd = async (d) => {
  const st = await fs.stat(d)
  if (!st.isDirectory()) {
    const p = path.dirname(d)
    if (p === d) {
      throw new Error('Could not find suitable wd')
    }
    return validWd(p)
  }
  return d
}

const runPackageLifecycle = async (pkg, env, wd, unsafe) => {
  // run package lifecycle scripts in the package root, or the nearest parent.
  const cmd = env.kyso_lifecycle_script
  const note = `\n> ${pkg.name} ${cmd} ${wd}`
  return runCmd(note, cmd, pkg, env, wd, unsafe)
}

const runCmd = async (note, cmd, pkg, env, wd, unsafe) => {
  if (process.platform === 'win32') {
    unsafe = true // eslint-disable-line
  }

  if (unsafe) {
    return runCmd_(cmd, pkg, env, wd, unsafe, 0, 0)
  }

  const uid = process.getuid()
  const gid = process.getgid()
  return runCmd_(cmd, pkg, env, wd, unsafe, uid, gid)
}

const runCmd_ = async (cmd, pkg, env, wd, unsafe, uid, gid) => {
  const conf = {
    cwd: wd,
    env,
    stdio: [0, 1, 2]
  }

  if (!unsafe) {
    conf.uid = uid ^ 0 // eslint-disable-line
    conf.gid = gid ^ 0 // eslint-disable-line
  }

  let sh = 'sh'
  let shFlag = '-c'
  if (process.platform === 'win32') {
    sh = process.env.comspec || 'cmd'
    shFlag = '/d /s /c'
    conf.windowsVerbatimArguments = true
  }

  const proc = spawn(sh, [shFlag, cmd], conf)

  const procError = (er) => {
    process.removeListener('SIGTERM', procKill)
    process.removeListener('SIGTERM', procInterupt)
    process.removeListener('SIGINT', procKill)
    if (er) throw er
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
    } else if (code) {
      const er = new Error(`Exit status ${code}`)
      er.errno = code
      procError(er)
    }
  })
  process.once('SIGTERM', procKill)
  process.once('SIGINT', procInterupt)
}

const runHookLifecycle = async (pkg, env, wd, unsafe) => { // eslint-disable-line
  // check for a hook script, run if present.
  const cmd = env.kyso_lifecycle_event
  const hook = path.join('', '.hooks', cmd)

  await fs.stat(hook)
  const note = `\n> ${pkg.name} ${cmd} ${wd}`
  runCmd(note, hook, pkg, env, wd, unsafe)
}

const makeEnv = async (data, prefix, env) => {
  prefix = prefix || 'kyso_package_' // eslint-disable-line
  if (!env) {
    env = {} // eslint-disable-line
    for (var i in process.env) { // eslint-disable-line
      if (!i.match(/^kyso_/)) {
        env[i] = process.env[i] // eslint-disable-line
      }
    }
  } else if (!data.hasOwnProperty('_lifecycleEnv')) {// eslint-disable-line
    Object.defineProperty(data, '_lifecycleEnv',
      {
        value: env,
        enumerable: false
      }
    )
  }

  for (i in data) {// eslint-disable-line
    if (i.charAt(0) !== '_') {// eslint-disable-line
      var envKey = (prefix + i).replace(/[^a-zA-Z0-9_]/g, '_')// eslint-disable-line
      if (i === 'readme') {// eslint-disable-line
        continue// eslint-disable-line
      }
      if (data[i] && typeof data[i] === 'object') { // eslint-disable-line
        try {
          // quick and dirty detection for cyclical structures
          JSON.stringify(data[i]) // eslint-disable-line
          makeEnv(data[i], envKey + '_', env) // eslint-disable-line
        } catch (ex) {
          // usually these are package objects.
          // just get the path and basic details.
          const d = data[i] // eslint-disable-line
          makeEnv(
            { name: d.name, version: d.version, path: d.path },
            envKey + '_', // eslint-disable-line
            env
          )
        }
      } else {
        env[envKey] = String(data[i]) // eslint-disable-line
        env[envKey] = env[envKey].indexOf('\n') !== -1 // eslint-disable-line
                        ? JSON.stringify(env[envKey])
                        : env[envKey]
      }
    }
  }

  if (prefix !== 'kyso_package_') return env

  const pkgConfig = {}
  const pkgVerConfig = {}
  prefix = 'kyso_package_config_' // eslint-disable-line
  ;[pkgConfig, pkgVerConfig].forEach((conf) => {
    for (var i in conf) { // eslint-disable-line
      env[(prefix + i)] = conf[i] // eslint-disable-line
    }
  })

  return env
}

exports = module.exports = lifecycle // eslint-disable-line
exports.makeEnv = makeEnv
exports._incorrectWorkingDirectory = _incorrectWorkingDirectory
