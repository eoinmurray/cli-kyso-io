const getFiles = require('./get-files')
const { hash } = require('./hash')
const fs = require('fs-promise')

const SEP = process.platform.startsWith('win') ? '\\' : '/'

module.exports = async (dir, pkg, { debug = false }) => {
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
          data: data.toString('base64')
        }
      })
    }))
  ))

  return files
}


const toRelative = (_path, base) => {
  const fullBase = base.endsWith(SEP) ? base : base + SEP
  let relative = _path.substr(fullBase.length)

  if (relative.startsWith(SEP)) {
    relative = relative.substr(1)
  }

  return relative.replace(/\\/g, '/')
}
