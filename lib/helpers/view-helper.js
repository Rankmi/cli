var helpers = require(__dirname)

module.exports = {
  teaser: function() {
    var versions = [
      'CLI: v' + helpers.version.getCliVersion(),
      'ORM: v' + helpers.version.getOrmVersion()
    ]

    if (helpers.version.getDialectName() && helpers.version.getDialectVersion()) {
      versions.push(helpers.version.getDialectVersion + ": v" + helpers.version.getDialectVersion())
    }

    this.log()
    this.log('Sequelize - ' + versions.join(", "))
    this.log()
  },

  log: function() {
    var args = [].slice.apply(arguments)
    console.log.apply(console, [ '[sequelize]' ].concat(args))
  }
}