const { createHash } = require('crypto')
const { readFile } = require('fs-promise')
const _debug = require('./output/debug')
/**
  * Computes hashes for the contents of each file given.
  *
  * @param {Array} of {String} full paths
  * @return {Map}
  */

const hashes = async (files) => {
  const map = new Map()

  await Promise.all(
    files.map(async name => {
      const data = await readFile(name)
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

const fileMapHash = (sha, name) => createHash('sha1').update(sha).update(name).digest('hex')

const versionHash = (hashList, message, { debug = false } = {}) => {
  // must add header which contains file names and message

  const filenames = hashList
    .map(h => h.file)
    .filter(h => h !== 'study.json')
    .sort()

  const header = `${filenames.join(',')}`
  _debug(debug, `Version has header: ${header}`)

  const dataBufferList = hashList
    .filter(h => h.file !== 'study.json')
    .map(h => h.sha)
    .sort() // <- NB since we need to versionHash to be the same every time
    .map(h => Buffer.from(h))

  const headerBuffer = Buffer.from(header)
  const buf = Buffer.concat(dataBufferList.concat(headerBuffer))
  const finalSha = createHash('sha1').update(buf).digest('hex')
  return finalSha
}

exports.hash = hashes
exports.versionHash = versionHash
exports.fileMapHash = fileMapHash
