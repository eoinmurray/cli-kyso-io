module.exports = async (args) => {
  const template = {
    name: args.name,
    author: args.author,
    tags: [],
    scripts: {
      start: "kyso docker start"
    },
    metadata: {}
  }

  return JSON.stringify(template, null, 2)
}
