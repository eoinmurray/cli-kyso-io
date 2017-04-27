const { resolve } = require('path')
const flatten = require('arr-flatten')
const unique = require('array-unique')
const ignore = require('ignore')
const _glob = require('glob')
const { stat, readdir, readFile } = require('fs-promise')
const _debug = require('./output/debug')
const chalk = require('chalk')
// Base `.gitignore` to which we add entries
// supplied by the user
const IGNORED = `.hg
.git
.merge
.gitmodules
.svn
.npmignore
.dockerignore
.gitignore
.ipynb-checkpoints
.*.swp
.DS_Store
.wafpicke-*
.lock-wscript
npm-debug.log
config.gypi
node_modules
CVS
Icon?
Icon^M
Icon*`

const glob = async (pattern, options) =>
  new Promise((resolve, reject) => { // eslint-disable-line
    _glob(pattern, options, (error, files) => {
      if (error) {
        reject(error)
      } else {
        resolve(files)
      }
    })
  })


/**
 * Remove leading `./` from the beginning of ignores
 * because our parser doesn't like them :|
 */

const clearRelative = (str) => str.replace(/(\n|^)\.\//g, '$1')

/**
 * Returns the contents of a file if it exists.
 *
 * @return {String} results or `''`
 */

const maybeRead = async (path, default_ = '') => {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    return default_
  }
}

/**
 * Transform relative paths into absolutes,
 * and maintains absolutes as such.
 *
 * @param {String} maybe relative path
 * @param {String} parent full path
 */

const asAbsolute = (path, parent) => {
  if (path[0] === '/') {
    return path
  }

  return resolve(parent, path)
}

/**
 * Returns a list of files in the given
 * directory that are subject to be
 * synchronized for kyso.
 *
 * @param {String} full path to directory
 * @param {String} contents of `package.json` to avoid lookup
 * @param {Object} options:
 *  - `limit` {Number|null} byte limit
 *  - `debug` {Boolean} warn upon ignore
 * @return {Array} comprehensive list of paths to sync
 */

async function getFiles(path, pkg, { limit = null, debug = false } = {}) {
  pkg = pkg || {} // eslint-disable-line
  const whitelist = pkg.files

  // The package.json `files` whitelist still
  // honors ignores: https://docs.kysojs.com/files/package.json#files
  const search_ = whitelist || ['.']
  // Convert all filenames into absolute paths
  const search = Array.prototype.concat.apply(
    [],
    await Promise.all(
      search_.map(file => glob(file, { cwd: path, absolute: true, dot: true }))
    )
  )

  // Always include the "main" file
  if (pkg.main) {
    search.push(require.resolve(resolve(path, pkg.main), 'may-exclude')) // Pkg: may-exclude suppresses warnings
  }

  // Compile list of ignored patterns and files
  const kysoIgnore = await maybeRead(resolve(path, '.kysoignore'), null)
  const gitIgnore = kysoIgnore === null
    ? await maybeRead(resolve(path, '.gitignore'))
    : null

  const filter = ignore()
    .add(
      `${IGNORED}\n${clearRelative(kysoIgnore === null ? gitIgnore : kysoIgnore)}`
    )
    .createFilter()

  const prefixLength = path.length + 1

  // The package.json `files` whitelist still
  // honors kysoignores: https://docs.kysojs.com/files/package.json#files
  // but we don't ignore if the user is explicitly listing files
  // under the kyso namespace, or using files in combination with gitignore
  const overrideIgnores = (pkg && pkg.files) || (gitIgnore !== null && pkg.files)
  const accepts = overrideIgnores
    ? () => true
    : file => {
      const relativePath = file.substr(prefixLength)
      if (relativePath === '') {
        return true
      }
      const accepted = filter(relativePath)
      _debug(!accepted && debug, `ignoring ${file}`)
      return accepted
    }

  // Locate files
  if (debug) {
    console.time(`${chalk.gray('[debug]')} locating files ${path}`)
  }

  const files = await explode(search, {
    accepts,
    limit,
    debug
  })

  if (debug) {
    console.timeEnd(`${chalk.gray('[debug]')} locating files ${path}`)
  }

  files.push(asAbsolute('study.json', path))

  // Get files
  return unique(files)
}

/**
 * Explodes directories into a full list of files.
 * Eg:
 *   in:  ['/a.js', '/b']
 *   out: ['/a.js', '/b/c.js', '/b/d.js']
 *
 * @param {Array} of {String}s representing paths
 * @param {Array} of ignored {String}s.
 * @param {Object} options:
 *  - `limit` {Number|null} byte limit
 *  - `debug` {Boolean} warn upon ignore
 * @return {Array} of {String}s of full paths
 */

async function explode(paths, { accepts, debug }) {
  const list = async file => {
    let path = file
    let s

    if (!accepts(file)) {
      return null
    }

    try {
      s = await stat(path)
    } catch (e) {
      // In case the file comes from `files` or `main`
      // and it wasn't specified with `.js` by the user
      path = `${file}.js`

      try {
        s = await stat(path)
      } catch (e2) {
        _debug(debug, `ignoring invalid file ${file}`)
        return null
      }
    }

    if (s.isDirectory()) {
      const all = await readdir(file)
      /* eslint-disable no-use-before-define */
      return many(all.map(subdir => asAbsolute(subdir, file)))
      /* eslint-enable no-use-before-define */
    } else if (!s.isFile()) {
      _debug(debug, `ignoring special file ${file}`)
      return null
    }

    return path
  }

  const many = all => Promise.all(all.map(file => list(file)))
  return flatten(await many(paths)).filter(v => v !== null)
}

module.exports = getFiles
