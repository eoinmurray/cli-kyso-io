
const isDev = (process.env.NODE_ENV === 'development')

module.exports = {
  PARSE_APP_ID: 'api-kyso-io',
  PARSE_SERVER_URL: isDev ? 'http://localhost:8080/parse' : 'https://api.kyso.io/parse',
  AUTH0_SERVER_URL: 'https://kyso.eu.auth0.com',
  AUTH0_CLIENT_ID: 'JfUqNS720w2fcqWbmNVa8YxssPRDxzqi'
}
