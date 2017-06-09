const getFiles = require('./get-files')
const { hash } = require('./hash')
const fs = require('fs-extra')
const path = require('path')

const SEP = process.platform.startsWith('win') ? '\\' : '/'

const getFileMap = async (dir, pkg, { debug = false, nameBy = 'sha', base64 = true } = {}) => {
  const fileList = await getFiles(dir, pkg, { debug })
  const hashes = await hash(fileList)

  const map = {}

  await Promise.all(Array.prototype.concat.apply([],
    await Promise.all(Array.from(hashes).map(async ([sha, { data, names }]) => {
      const statFn = fs.stat
      return names.map(async name => {
        const mode = await (await statFn(name)).mode
        const o = {
          sha,
          size: data.length,
          name: toRelative(name, dir),
          path: path.join(dir, toRelative(name, dir)),
          mode,
          data: base64 ? data.toString('base64') : null
        }
        map[o[nameBy]] = o
      })
    }))
  ))

  return map
}


const getFileList = async (dir, pkg, { debug = false, base64 = true } = {}) => {
  const fileList = await getFiles(dir, pkg, { debug })
  const hashes = await hash(fileList)

  const files = await Promise.all(Array.prototype.concat.apply([],
    await Promise.all(Array.from(hashes).map(async ([sha, { data, names }]) => {
      const statFn = fs.stat
      return names.map(async name => {
        const mode = await (await statFn(name)).mode
        return {
          sha,
          size: data.length,
          file: toRelative(name, dir),
          mode,
          binary: data,
          data: base64 ? data.toString('base64') : null
        }
      })
    }))
  ))
  return files
}

const getConflicts = async (dir, conflictStrings = [], { debug = false, nameBy = 'sha' } = {}) => {
  const fileList = await getFiles(dir, null, { debug })
  const hashes = await hash(fileList)

  const map = {}

  await Promise.all(Array.prototype.concat.apply([],
    await Promise.all(Array.from(hashes).map(async ([sha, { data, names }]) => {
      const statFn = fs.stat
      return names.map(async name => {
        const hasConflict = conflictStrings.some((string) => data.toString().includes(string))
        if (hasConflict) {
          const mode = await (await statFn(name)).mode
          const o = {
            sha,
            size: data.length,
            name: toRelative(name, dir),
            path: path.join(dir, toRelative(name, dir)),
            mode,
          }
          map[o[nameBy]] = o
        }
      })
    }))
  ))
  return map
}

const toRelative = (_path, base) => {
  const fullBase = base.endsWith(SEP) ? base : base + SEP
  let relative = _path.substr(fullBase.length)

  if (relative.startsWith(SEP)) {
    relative = relative.substr(1)
  }

  return relative.replace(/\\/g, '/')
}

module.exports = { getFileList, getFileMap, getConflicts, toRelative }
