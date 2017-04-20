const { createHash } = require('crypto')
const path = require('path')
const { readFile } = require('fs-promise')
const _debug = require('./output/debug')
/**
  * Computes hashes for the contents of each file given.
  *
  * @param {Array} of {String} full paths
  * @return {Map}
  */

const hashes = async (files, isStatic, pkg) => {
  const map = new Map()

  await Promise.all(
    files.map(async name => {
      const filename = path.basename(name)
      let data

      if (isStatic && filename === 'package.json') {
        const packageString = JSON.stringify(pkg, null, 2)
        data = Buffer.from(packageString)
      } else {
        data = await readFile(name)
      }

      const h = hash(data)
      const entry = map.get(h)
      if (entry) {
        entry.names.push(name)
      } else {
        map.set(hash(data), { names: [name], data })
      }
    })
  )
  return map
}

/**
 * Computes a hash for the given buf.
 *
 * @param {Buffer} file data
 * @return {String} hex digest
 */

const hash = (buf) => createHash('sha1').update(buf).digest('hex')

const versionHash = (hashList, message, { debug = false } = {}) => {
  // must add header which contains file names and message

  const filenames = hashList
    .map(h => h.file)
    .sort()

  const header = `${filenames.join(',')}`
  _debug(debug, `Version has header: ${header}`)

  const dataBufferList = hashList
    .map(h => h.sha)
    .sort() // <- NB since we need to versionHash to be the same every time
    .map(h => Buffer.from(h))

  const headerBuffer = Buffer.from(header)
  const buf = Buffer.concat(dataBufferList.concat(headerBuffer))
  const finalSha = createHash('sha1').update(buf).digest('hex')
  // _debug(debug, `Sha no header: ${createHash('sha1').update(Buffer.concat(dataBufferList)).digest('hex')}`)
  // _debug(debug, `Sha of header: ${createHash('sha1').update(Buffer.concat([headerBuffer])).digest('hex')}`)
  // _debug(debug, `Sha with header: ${finalSha}`)

  return finalSha
}

exports.hash = hashes
exports.versionHash = versionHash
