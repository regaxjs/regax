const { createAgent } = require('./lib')
module.exports = function (app) {
  return createAgent(app)
}
