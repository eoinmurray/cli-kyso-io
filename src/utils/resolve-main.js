const SEP = process.platform.startsWith('win') ? '\\' : '/'

module.exports = async (files, pkg) => {
  // map the files object to only the names
  // then filter in only the ones in the top level folder
  if (pkg.main) return pkg.main

  const fnames = files
    .map(o => o.file)
    .filter(name => name.split(SEP).length === 1)

  if (fnames.includes('notebook.ipynb')) return 'notebook.ipynb'
  if (fnames.includes('notebook.rmd')) return 'notebook.rmd'
  if (fnames.includes('notebook.md')) return 'notebook.md'
  if (fnames.includes('notebook.txt')) return 'notebook.txt'

  return false
}
