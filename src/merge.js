const fs = require('fs-extra')
const pify = require('pify')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const path = require('path')
const { mergeLines, mergeJupyter } = require('./utils/merge')
const { getFileMap } = require('./utils/get-file-map')
const _debug = require('./utils/output/debug')

const mapOpts = {
  nameBy: 'name',
  base64: false
}

const merge = async (src, target, base, { debug = null, canDelete = true } = {}) => {
  const srcMap = await getFileMap(path.resolve(src), null, mapOpts)
  const targetMap = await getFileMap(path.resolve(target), null, mapOpts)
  const baseMap = await getFileMap(path.resolve(base), null, mapOpts)

  const conflicts = []
  await Promise.all(Object.values(srcMap).map(async (srcFile) => {
    if (!targetMap[srcFile.name]) {
      _debug(debug, `Copying ${srcFile.name}`)
      return copyFile(srcFile.path, path.join(target, srcFile.name))
    }
    const targetFile = targetMap[srcFile.name]

    // if hashes match then files are the same, do nothing
    if (targetFile.sha === srcFile.sha) {
      _debug(debug, `Identical ${srcFile.name}`)
      return true
    }

    if (srcFile.name === 'study.json') {
      _debug(debug, `Ignoring ${srcFile.name}`)
      return true
    }

    _debug(debug, `Conflict ${srcFile.name}`)
    const baseFile = baseMap[srcFile.name]
    conflicts.push(targetFile)
    return mergeFile(srcFile.path, targetFile.path, baseFile.path, { debug })
  }))

  // delete the merge folder to signify that we are done
  if (canDelete) {
    await pify(rimraf)(path.resolve('.kyso', 'merge'))
  }
  return conflicts
}


const lsConflicts = async (src, target, { debug = null } = {}) => {
  const targetMap = await getFileMap(path.resolve(target), null, mapOpts)
  const conflicts = []
  let srcExists = false

  try {
    await fs.stat(path.resolve(src))
    srcExists = true
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }

  if (srcExists) {
    // the .merge/target folder exists so lets compare to that
    const srcMap = await getFileMap(path.resolve(src), null, mapOpts)
    await Promise.all(Object.values(srcMap).map(async (srcFile) => {
      if (!targetMap[srcFile.name]) return
      const targetFile = targetMap[srcFile.name]
      if (targetFile.sha === srcFile.sha) return
      if (srcFile.name === 'study.json') return
      _debug(debug, `Conflict ${srcFile.name}`)
      conflicts.push(targetFile)
    }))
    return conflicts
  }

  // otherwise lets just look for the presence of <<<<<< in the local files
  await Promise.all(Object.values(targetMap).map(async (file) => {
    const content = await fs.readFile(file.path, 'utf-8')
    if (content.includes('<<<<<<<') || content.includes('>>>>>>>')) {
      _debug(debug, `Conflict ${file.name}`)
      conflicts.push(file)
    }
  }))
  return conflicts
}


const copyFile = async (src, target) => {
  await pify(mkdirp)((target).split('/').slice(0, -1).join('/'))
  return fs.writeFile(target, await fs.readFile(src))
}


const mergeFile = async (src, target, base) => {
  let output = ""
  const targetContent = await fs.readFile(target, 'utf-8')
  if (targetContent.includes('<<<<<<<') || targetContent.includes('>>>>>>>')) {
    // dont merge if it already has conflicts
    return false
  }

  if (src.endsWith('.ipynb')) {
    const out = path.join(path.dirname(target), `out-${path.basename(target)}`)
    await mergeJupyter(base, src, target, out)
    await fs.writeFile(target, await fs.readFile(out))
    await fs.unlink(out)
    return false
  }

  const srcContent = await fs.readFile(src, 'utf-8')
  const baseContent = await fs.readFile(base, 'utf-8')
  output = mergeLines(baseContent, srcContent, targetContent)
  return fs.writeFile(target, output)
}


module.exports = { merge, lsConflicts }
