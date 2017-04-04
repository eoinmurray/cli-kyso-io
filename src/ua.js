const os = require('os')
const { version } = require('./pkg')

module.exports = `kyso ${version} node-${process.version} ${os.platform()} (${os.arch()})`
