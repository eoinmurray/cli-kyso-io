const error = require('./utils/output/error')

function handleError(err) {
  if (err.status === 403) {
    return error('Authentication error. Run `kyso -L` or `kyso --login` to log-in again.')
  }

  if (err.status === 429) {
    if (err.retryAfter === 'never') {
      return error(err.message)
    }
    if (err.retryAfter === null) {
      return error('Rate limit exceeded error. Please try later.')
    }
    return error('Rate limit exceeded error.')
  }

  if (err.userError) {
    return error(err.message)
  }
  if (err.status === 500) {
    return error('Unexpected server error. Please retry.')
  }

  return error(`Unexpected error. (${err.message})`)
}

module.exports = {
  handleError,
  error
}
