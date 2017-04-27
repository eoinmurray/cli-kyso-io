const fs = require('fs-promise')
const pify = require('pify')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const path = require('path')
const { getFileMap } = require('./utils/get-file-map')
const _debug = require('./utils/output/debug')
const { mergeLines, mergeJupyter } = require('./utils/diff')

/*
  Can diff files and leave the conflict in the targetination file

  need to figure out when to show jupyter merger

  need to add options to the commmand for getting two versions to merge
  and how to allow file merging.
*/

const copyFile = async (src, target) => {
  await pify(mkdirp)((target).split('/').slice(0, -1).join('/'))
  return fs.writeFile(target, await fs.readFile(src))
}

const mergeFiles = async (src, target, base) => {
  let output = ""
  if (src.endsWith('.ipynb')) {
    const targetContent = await fs.readFile(target, 'utf-8')
    if (targetContent.includes('<<<<<<<') || targetContent.includes('>>>>>>>')) return true
    const outputFile = path.join(path.dirname(target), `out-${path.basename(target)}`)
    await mergeJupyter(base, src, target, outputFile)
    await fs.writeFile(target, await fs.readFile(outputFile, 'utf-8'))
    await fs.unlink(outputFile)
    return true
  }

  const srcContent = await fs.readFile(src, 'utf-8')
  const targetContent = await fs.readFile(target, 'utf-8')
  if (targetContent.includes('<<<<<<<') || targetContent.includes('>>>>>>>')) return false
  const baseContent = await fs.readFile(base, 'utf-8')
  output = mergeLines(baseContent, srcContent, targetContent)
  return fs.writeFile(target, output)
}


const lsConflicts = async (src, target, { debug = null } = {}) => {
  const targetMap = await getFileMap(path.resolve(target), null, { nameBy: 'name', base64: false })
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
    const srcMap = await getFileMap(path.resolve(src), null, { nameBy: 'name', base64: false })

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

const merge = async (src, target, base, { debug = null } = {}) => {
  const srcMap = await getFileMap(path.resolve(src), null, { nameBy: 'name', base64: false })
  const targetMap = await getFileMap(path.resolve(target), null, { nameBy: 'name', base64: false })
  const baseMap = await getFileMap(path.resolve(base), null, { nameBy: 'name', base64: false })

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
    return mergeFiles(srcFile.path, targetFile.path, baseFile.path, { debug })
  }))

  // delete the merge folder to signify that we are done
  await pify(rimraf)(path.resolve('.merge'))
  return conflicts
}

module.exports = { merge, lsConflicts }
