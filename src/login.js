const chalk = require('chalk')
const fetch = require('node-fetch')
const { validate } = require('email-validator')
const { getUser } = require('./rest-request')
const readEmail = require('email-prompt')
const secrets = require('./secrets')
const cfg = require('./cfg')
const ua = require('./ua')
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

  await requestPasswordlessLogin(email)

  console.log(`> We have sent a verification code to ${chalk.bold(email)}.`)
  console.log('> Please enter the code to login.')
  process.stdout.write('\n')

  const code = await textInput({ label: '- Code: ' })

  console.log('> Logging you in.')

  // do something here to retrieve and check email
  const { access_token } = await verifyCode(email, code)
  const { parse_session_token } = await getAuth0Profile(email, access_token)
  const user = await getUser(parse_session_token)
  // const { sessionToken } = await getRestrictedSession(parse_session_token)

  process.stdout.write('\n')

  return {
    email,
    auth0_token: access_token,
    token: parse_session_token,
    nickname: user.nickname
  }
}

module.exports = async function () {
  const loginData = await register()

  cfg.merge(loginData)
  return loginData.access_token
}
