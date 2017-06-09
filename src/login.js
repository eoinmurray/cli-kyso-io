const chalk = require('chalk')
const fetch = require('node-fetch')
const { validate } = require('email-validator')
const readEmail = require('email-prompt')
const secrets = require('./secrets')
const cfg = require('./kyso-cfg')
const wait = require('../src/utils/output/wait')
const textInput = require('./utils/input/text')

async function requestPasswordlessLogin(email) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/passwordless/start`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: secrets.AUTH0_CLIENT_ID,
      connection: 'email',
      email: `${email}`,
      send: 'code',
      authParams: {
        scope: 'openid',
      }
    })
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
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
  await requestPasswordlessLogin(email)
  s()
  //
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
  return loginData.access_token
}
