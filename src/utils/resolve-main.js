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

  const er = new Error(`\nCannot find notebook.(ipynb, rmd, md, txt) in this dir, and
no main file is specified in the study.json.

This means that kyso wont know what file to render online.

Please make a main file called notebook with extention
ipynb, rmd, md, or txt or specify a main file using
'kyso main <yourfile>'`)
  er.userError = true
  throw er
}
