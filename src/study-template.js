const { exec } = require('child-process-promise')

module.exports = async (args) => {
  const template = {
    name: args.name,
    author: args.author,
    tags: [],
    // version: {},
    scripts: {},
    // files: [],
    metadata: {}
  }

  const origin = (await exec('git config --get remote.origin.url')).stdout.replace('\n', '')
  const branch = (await exec('git rev-parse --abbrev-ref HEAD')).stdout.replace('\n', '')
  const commit = (await exec('git rev-parse HEAD')).stdout.replace('\n', '')

  if (branch || commit) {
    template.repository = {
      url: origin,
      branch,
      commit
    }
  }

  return JSON.stringify(template, null, 3)
}
