const chalk = require('chalk')
const fetch = require('node-fetch')
const { validate } = require('email-validator')
const { getUser } = require('./rest-request')
const readEmail = require('email-prompt')
const secrets = require('./secrets')
const cfg = require('./kyso-cfg')
const ua = require('./ua')
const wait = require('../src/utils/output/wait')
// const info = require('./utils/output/info')
// const promptBool = require('./utils/input/prompt-bool')
const textInput = require('./utils/input/text')

async function requestPasswordlessLogin(email) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/passwordless/start`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ua
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

async function verifyCode(email, verificationToken) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/oauth/ro`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ua
    },
    body: JSON.stringify({
      client_id: secrets.AUTH0_CLIENT_ID,
      connection: 'email',
      username: `${email}`,
      grant_type: 'password',
      send: 'code',
      password: verificationToken,
      authParams: {
        scope: 'openid',
      }
    })
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function getAuth0Profile(email, token) {
  const res = await fetch(`${secrets.AUTH0_SERVER_URL}/userinfo`, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': ua
    },
  })

  if (res.status !== 200) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  return body
}

async function getRestrictedSession(token) {
  const res = await fetch(`${secrets.PARSE_SERVER_URL}/sessions`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': secrets.PARSE_APP_ID,
      'X-Parse-REST-API-Key': secrets.PARSE_FILE_KEY,
      'X-Parse-Session-Token': token,
      'User-Agent': ua
    }
  })

  if (res.status !== 201) { throw new Error(`${res.status}, ${res.statusText}`) }
  const body = await res.json()
  console.log(body)
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

  // process.stdout.write('\n')
  // info(`By continuing, you declare that you agree with ${chalk.bold('https://kyso.io/terms')} and ${chalk.bold('https://kyso.io/privacy.')}`)
  // if (!await promptBool('Continue?')) {
  //   info('Aborted.')
  //   process.exit() // eslint-disable-line unicorn/no-process-exit
  // }

  if (!validate(email)) { return register({ retryEmail: true }) }

  let s = wait(`Sending verification email`)
  await requestPasswordlessLogin(email)
  s()

  console.log(`> We have sent a verification code to ${chalk.bold(email)}.`)
  console.log('> Please enter the code to login.')

  const code = await textInput({ label: '- Code: ' })


  s = wait(`Checking verification`)
  const { access_token } = await verifyCode(email, code)
  s(); s = wait(`Retrieving auth details`)
  const { parse_session_token } = await getAuth0Profile(email, access_token)
  s(); s = wait(`Retrieving user token`)
  const user = await getUser(parse_session_token)
  // const { sessionToken } = await getRestrictedSession(parse_session_token)
  s()

  return {
    email,
    auth0_token: access_token,
    token: parse_session_token,
    nickname: user.nickname
  }
}

module.exports = async () => {
  const loginData = await register()

  cfg.merge(loginData)
  return loginData.access_token
}
