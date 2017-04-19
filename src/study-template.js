module.exports = async (args) => {
  const template = {
    name: args.name,
    author: args.author,
    tags: [],
    scripts: {},
    metadata: {}
  }

  return JSON.stringify(template, null, 3)
}
