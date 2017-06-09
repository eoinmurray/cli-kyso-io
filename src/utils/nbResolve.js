const fs = require('fs-extra')
const path = require('path')

const getBody = (lines, delimiter1, delimiter2) => {
  const idx = lines.map((line, index) => { // eslint-disable-line
    return line.includes(delimiter1) ? index : null
  }).filter(x => x !== null)

  const bounds = []
  while (idx.length > 0) bounds.push(idx.splice(0, 2))

  const body = lines.filter((line, index) => {
    const isOutside = !bounds.some(b => b[0] <= index && b[1] >= index)
    return isOutside
  })

  return body
    .filter(line => !line.includes(delimiter2))
    .join('\n')
}


module.exports = async (file) => {
  const buf = await fs.readFile(path.resolve(file))
  const lines = buf.toString().split('\n')

  const newer = getBody(lines, '++++++', '------')
  const older = getBody(lines, '------', '++++++')

  const newerPath = path.join(path.dirname(path.resolve(file)), '.newer.ipynb')
  const olderPath = path.join(path.dirname(path.resolve(file)), '.older.ipynb')

  await fs.writeFile(newerPath, newer)
  await fs.writeFile(olderPath, older)
}
