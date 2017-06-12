const { diffJupyter } = require('./utils/merge')

const diff = async (target, current) => {
  diffJupyter(target, current)
}

const diffWeb = async (target, current) => {
  diffJupyter(target, current, 'nbdime diff-web')
}


module.exports = { diff, diffWeb }
