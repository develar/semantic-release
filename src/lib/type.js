module.exports = function (config, cb) {
  const plugins = config.plugins
  const lastRelease = config.lastRelease

  // if (plugins.analyzeCommits == null) {
  //   const conventionalCommitsParser = require('conventional-commits-parser')
  //   for (let commit of config.commits) {
  //     let angularPreset = {
  //       headerPattern: /^(\w*)(?:\((.*)\))?\: (.*)$/,
  //       headerCorrespondence: [
  //         'type',
  //         'scope',
  //         'subject'
  //       ],
  //       noteKeywords: 'BREAKING CHANGE',
  //       revertPattern: /^revert:\s([\s\S]*?)\s*This reverts commit (\w*)\./,
  //       revertCorrespondence: ['header', 'hash']
  //     };
  //     const data = conventionalCommitsParser.sync(commit.message, angularPreset)
  //   }
  //   return
  // }

  plugins.analyzeCommits(config, function (err, type) {
    if (err) return cb(err)

    if (!type) {
      return cb(new Error('There are no relevant changes, so no new version is released.'))
    }

    if (!lastRelease.version) return cb(null, 'initial')

    cb(null, type)
  })
}
