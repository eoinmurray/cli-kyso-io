// Native
const os = require('os')
const http = require('http')
// Packages
const chalk = require('chalk')
const fetch = require('node-fetch')
const { validate } = require('email-validator')
const readEmail = require('email-prompt')
// Ours
const secrets = require('./secrets')
const cfg = require('./cfg')
const info = require('./utils/output/info')
const promptBool = require('./utils/input/prompt-bool')
const textInput = require('./utils/input/text')

async function requestPasswordlessLogin(email) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/passwordless/start`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: secrets.AUTH0_CLIENT_ID,
      connection: 'email',
      email: `${email}`,
      send: 'code',
      authParams:{
        scope: 'openid',
      }
    })
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function verifyCode(email, verificationToken) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/oauth/ro`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: secrets.AUTH0_CLIENT_ID,
      connection: 'email',
      username: `${email}`,
      grant_type: 'password',
      send: 'code',
      password: verificationToken,
      authParams:{
        scope: 'openid',
      }
    })
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function getProfile(email, access_token, token_type) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/userinfo`, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${access_token}` },
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function getRestrictedSession(parse_session_token) {
  const res = await fetch(`${secrets.PARSE_SERVER_URL}/sessions`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': secrets.PARSE_APP_ID,
      'X-Parse-REST-API-Key': secrets.PARSE_FILE_KEY,
      'X-Parse-Session-Token': parse_session_token
    }
  })

  if (res.status !== 201) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function register({ retryEmail = false } = {}) {
  let email
  try {
    email = await readEmail({ invalid: retryEmail })
  } catch (err) {
    process.stdout.write('\n')
    throw err
  }

  process.stdout.write('\n')
  info(`By continuing, you declare that you agree with ${chalk.bold('https://kyso.io/terms')} and ${chalk.bold('https://kyso.io/privacy.')}`)
  if (!await promptBool('Continue?')) {
    info('Aborted.')
    process.exit() // eslint-disable-line unicorn/no-process-exit
  }

  if (!validate(email)) { return register({ retryEmail: true }) }

  await requestPasswordlessLogin(email)

  console.log(`> We have sent a verification code to ${chalk.bold(email)}.`)
  console.log(`> Please enter the code to login.`)
  process.stdout.write('\n')

  const code = await textInput({ label: '- Code: ' })

  console.log(`> Logging you in.`)

  // do something here to retrieve and check email
  const { access_token, token_type } = await verifyCode(email, code)
  const { parse_session_token } = await getProfile(email, access_token, token_type)
  const { sessionToken } = await getRestrictedSession(parse_session_token)

  process.stdout.write('\n')

  return { email, auth0_token: access_token, parse_session_token: sessionToken}
}

module.exports = async function() {
  const loginData = await register()

  cfg.merge(loginData)
  return loginData.access_token
}
