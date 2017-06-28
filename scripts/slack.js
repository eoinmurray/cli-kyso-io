#!/usr/bin/env node

const slackup = require('slackup')
const fetch = require('node-fetch')

const repo = process.env.TRAVIS_REPO_SLUG
const commit = process.env.TRAVIS_COMMIT
const branch = process.env.TRAVIS_BRANCH
const apiKey = process.env.SLACK_API_KEY
const channel = process.env.SLACK_CHANNEL
const githubToken = process.env.GITHUB_API_KEY
const currentNodeVersion = process.env.TRAVIS_NODE_VERSION
const regex = /^(node|7)\.*/

if (!apiKey) {
  console.log('$SLACKUP_TOKEN not found')
  process.exit(0)
}

if (!channel) {
  console.log('$SLACKUP_CHANNEL not found')
  process.exit(0)
}

if (!githubToken) {
  console.log('$GITHUB_TOKEN not found')
  process.exit(0)
}

const opts = {
  headers: {
    authorization: `token ${githubToken}`
  }
}

fetch(`https://api.github.com/repos/${repo}/commits/${commit}`, opts)
  .then(res => res.json())
  .then(res => ({
    message: res.commit.message,
    authorName: res.commit.author.name,
    authorUrl: res.author.html_url
  }))
  .then(async res => {
    if (regex.test(currentNodeVersion)) {
      const message = `:package: Here are the binaries for the branch *${branch}* of *${repo}* (commit <https://github.com/${repo}/commit/${commit}|${commit.substr(0, 7)}> by <${res.authorUrl}|${res.authorName}>):`
      const binaries = [
        `${__dirname}/../packed/kyso-macos`,
        `${__dirname}/../packed/kyso-linux`,
        `${__dirname}/../packed/kyso-win.exe`
      ]
      try {
        console.log(`Sending info to slack #${channel}`)
        await slackup({ apiKey, channel, type: 'message', message })
        await slackup({ apiKey, channel, type: 'file', filePath: binaries[0] })
        await slackup({ apiKey, channel, type: 'file', filePath: binaries[1] })
        await slackup({ apiKey, channel, type: 'file', filePath: binaries[2] })
      } catch (err) {
        console.log(`Couldn't send messages/files to Slack`, err)
      }
    } else {
      setTimeout(async () => {
        const message = `:white_check_mark: Build succeded on Node ${currentNodeVersion} (commit <https://github.com/${repo}/commit/${commit}|${commit.substr(0, 7)}> by <${res.authorUrl}|${res.authorName}>)`
        await slackup({ apiKey, channel, type: 'message', message })
      }, 10000)
    }
  })
  .catch(console.error)
