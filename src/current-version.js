const getSVF = require('./get-svf')
const { getFileList } = require('./utils/get-file-map')
const { versionHash } = require('./utils/hash')
const wait = require('./utils/output/wait')


const bucket = (local, remote) => {
  const added = []
  const removed = []
  const modified = []
  const unchanged = []

  const localKeys = Object.keys(local)
  const remoteKeys = Object.keys(remote)

  localKeys.forEach(key => {
    if (!remoteKeys.includes(key)) {
      return removed.push({ name: key, sha: remote[key] })
    }
    if (remote[key] === local[key]) {
      return unchanged.push({ name: key, sha: remote[key] })
    }
    return modified.push({ name: key, sha: remote[key] })
  })

  remoteKeys.forEach(key => {
    if (!localKeys.includes(key)) {
      added.push({ name: key, sha: remote[key] })
    }
  })

  return {
    unchanged,
    added,
    removed,
    modified
  }
}


const currentVersion = async (dir, pkg, token, { debug = false } = {}) => {
  let s = wait(`Reading files`)
  const localFiles = await getFileList(dir, pkg, { debug, base64: false })
  s()

  s = wait(`Fetching last version and files`)
  const { version, files: remoteFiles } = await getSVF(pkg.name, pkg.author, token,
    { versionSha: pkg._version, debug })

  s()

  const versionSha = versionHash(localFiles, version.get('message'), { debug })

  const _localFiles = localFiles
    .reduce(((acc, f) => {
      acc[f.file] = f.sha
      return acc
    }), {})

  const _remoteFiles = remoteFiles
  .reduce(((acc, f) => {
    acc[f.get('name')] = f.get('sha')
    return acc
  }), {})

  const {
    unchanged,
    added,
    removed,
    modified
  } = bucket(_localFiles, _remoteFiles)

  return {
    version,
    currentSha: versionSha,
    isDirty: versionSha !== version.get('sha'),
    unchanged,
    added,
    removed,
    modified
  }
}


module.exports = currentVersion
