const chalk = require('chalk')
const fetch = require('node-fetch')
const { validate } = require('email-validator')
const readEmail = require('email-prompt')
const cfg = require('./kyso-cfg')
const wait = require('../src/utils/output/wait')
const textInput = require('./utils/input/text')

async function requestPasswordlessLogin(url, email) {
  const res = await fetch(`${url}/functions/passwordless`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': 'api-kyso-io'
    },
    body: JSON.stringify({ email })
  })

  const body = await res.json()
  if (body.error) {
    throw new Error(body.error.message || body.error)
  }
  if (body.success) {
    return body
  }

  return false
}

async function register(url, debug, { retryEmail = false } = {}) {
  let email
  try {
    email = await readEmail({ invalid: retryEmail })
  } catch (err) {
    process.stdout.write('\n')
    throw err
  }

  if (!validate(email)) { return register({ retryEmail: true }) }

  let s = wait(`Sending verification email`)
  await requestPasswordlessLogin(url, email)
  s()
  console.log(`> We have sent a verification code to ${chalk.bold(email)}.`)
  console.log('> Please enter the code to login.')
  const code = await textInput({ label: '- Code: ' })

  s = wait(`Checking verification`)
  const res = await fetch(`${url.replace('/parse', '')}/verify-login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, code })
  })
  const body = await res.json()
  s()

  if(body.hasOwnProperty('error')) { // eslint-disable-line
    const err = new Error(body.error)
    err.userError = true
    throw err
  }

  const { access_token, sessionToken, user } = body

  return {
    email,
    auth0_token: access_token,
    token: sessionToken,
    nickname: user.nickname
  }
}

module.exports = async ({ debug, url }) => {
  const loginData = await register(url, debug)

  cfg.merge(loginData)
  return loginData.token
}
