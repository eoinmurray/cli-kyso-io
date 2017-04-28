const Stream = require('stream')

module.exports = new Stream.Writable({
  write: (chunk, encoding, next) => {
    const line = chunk
      .toString('utf8')
      .replace(new RegExp('{"stream":"', 'g'), '')
      .replace(new RegExp('}', 'g'), '')
      .replace(/\\/g, '')
      .replace(/n"/g, '')
      .replace(/u003e/g, '>')
    process.stdout.write(line)
    next()
  }
})
