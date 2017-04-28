const test = require('ava')
const { readFile, writeFile } = require('fs-promise')
const { join, resolve } = require('path')
const { merge } = require('../src/merge')
const { mergeJupyter } = require('../src/utils/merge')

const fixture = name => resolve(`./test/_fixtures/${name}`)

const debug = false

test('`correctly reports conflicts`', async t => {
  const target = fixture(`merge`)
  const src = join(fixture(`merge`), '.kyso', 'merge', 'target')
  const base = join(fixture(`merge`), '.kyso', 'merge', 'base')

  const conflicts = await merge(src, target, base, { debug, canDelete: false })
  const names = conflicts.map(c => c.name)
  const content = await readFile(join(target, 'a.txt'), 'utf-8')
  const expectedContent = `1\n2\n<<<<<<<<<< \n4\n========== \n5\n>>>>>>>>>>\n`

  await writeFile(join(target, 'a.txt'), '1\n2\n5\n')
  await writeFile(join(target, 'notebook.ipynb'), await readFile(join(target, 'restore-notebook.ipynb')))
  t.is(names.length, 2)
  t.is(names[0], 'a.txt')
  t.is(names[1], 'notebook.ipynb')
  t.is(content, expectedContent)
})

test('`correctly reports nbdime not installed`', async t => {
  try {
    await mergeJupyter('', '', '', '', 'nsdime')
  } catch (e) {
    t.is(e.message, `nbdime is needed to merge Jupyter notebooks. Run 'pip install nbdime' to install it.`)
    t.is(e.userError, true)
  }
})
