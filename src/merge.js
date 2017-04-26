const fs = require('fs-promise')
const pify = require('pify')
const mkdirp = require('mkdirp')
const path = require('path')
const { getFileMap } = require('./utils/get-file-map')
const _debug = require('./utils/output/debug')
const { diffLines } = require('diff')

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

const conflict = async (src, target) => {
  const srcContent = await fs.readFile(src, 'utf-8')
  const targetContent = await fs.readFile(target, 'utf-8')

  const diff = diffLines(srcContent, targetContent)
  const out = diff.map((part) => {
    if (part.removed) {
      return `------ ${path.basename(path.dirname(src.replace('.', '')))}\n${part.value}------\n`
    }
    if (part.added) {
      return `++++++ ${path.basename(path.dirname(target))}\n${part.value}++++++\n`
    }
    return `${part.value}`
  }).join('')

  return fs.writeFile(target, out)
}

const merge = async (src, target, base, { debug = null } = {}) => {
  const srcMap = await getFileMap(path.resolve(src), null, { nameBy: 'name', base64: false })
  const targetMap = await getFileMap(path.resolve(target), null, { nameBy: 'name', base64: false })

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
    conflicts.push(targetFile)
    return conflict(srcFile.path, targetFile.path, { debug })
  }))

  return conflicts
}

const lsConflicts = async (src, target, { debug = null } = {}) => {
  const srcMap = await getFileMap(path.resolve(src), null, { nameBy: 'name', base64: false })
  const targetMap = await getFileMap(path.resolve(target), null, { nameBy: 'name', base64: false })

  const conflicts = []
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

module.exports = { merge, lsConflicts }
