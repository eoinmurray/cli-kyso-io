const { exec } = require('child-process-promise')

module.exports = async () => {
  const origin = (await exec('git config --get remote.origin.url')).stdout.replace('\n', '')
  const branch = (await exec('git rev-parse --abbrev-ref HEAD')).stdout.replace('\n', '')
  const commit = (await exec('git rev-parse HEAD')).stdout.replace('\n', '')

  return {
    url: origin,
    branch,
    commit
  }
}
