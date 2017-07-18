#!/usr/bin/env node

try {
  // eslint-disable-next-line import/no-unassigned-import
  require('../bin/kyso.js')
} catch (err) {
  if (err.code === 'ENOENT' && err.syscall === 'uv_cwd') {
    console.error(`Current path doesn't exist!`)
    process.exit(1)
  } else {
    throw err
  }
}
