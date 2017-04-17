const { exec } = require('child-process-promise')

module.exports = async (args) => {
  const template = {
    name: args.name,
    author: args.author,
    tags: [],
    scripts: {},
    metadata: {}
    // files: [],
    // version: {},
  }

  return JSON.stringify(template, null, 3)
}
