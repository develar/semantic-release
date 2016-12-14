const auto = require('run-auto')
const semver = require('semver')

const getCommits = require('./lib/commits')
const getType = require('./lib/type')

const SemanticReleaseError = require('@semantic-release/error')
const RegClient = require('npm-registry-client')

module.exports = function (config, cb) {
  const plugins = config.plugins

  auto({
    lastRelease: (plugins.getLastRelease == null ? lastReleaseNpm : plugins.getLastRelease).bind(null, config),
    commits: ['lastRelease', function (results, cb) {
      getCommits(Object.assign({
        lastRelease: results.lastRelease
      }, config),
      cb)
    }],
    type: ['commits', 'lastRelease', function (results, cb) {
      getType(Object.assign({
        commits: results.commits,
        lastRelease: results.lastRelease
      }, config),
      cb)
    }]
  }, function (err, results) {
    if (err) return cb(err)

    const nextRelease = {
      type: results.type,
      version: results.type === 'initial'
        ? '1.0.0'
        : semver.inc(results.lastRelease.version, results.type)
    }

    plugins.verifyRelease(Object.assign({
      commits: results.commits,
      lastRelease: results.lastRelease,
      nextRelease: nextRelease
    }, config), function (err) {
      if (err) return cb(err)
      cb(null, nextRelease)
    })
  })
}

function lastReleaseNpm(config, cb) {
  const clientConfig = {}
  const client = new RegClient(clientConfig);

  client.get(`${config.registry}${config.pkg.name.replace('/', '%2F')}`, {
    auth: config.auth
  }, function (err, data) {
    if (err && (err.statusCode === 404 || /not found/i.test(err.message))) {
      return cb(null, {});
    }

    if (err) {
      return cb(err)
    }

    const options = config.options
    const tag = config.tag
    let version = data['dist-tags'][tag]
    if (!version && options && options.fallbackTags && options.fallbackTags[tag] && data['dist-tags'][options.fallbackTags[tag]]) {
      version = data['dist-tags'][options.fallbackTags[tag]];
    }

    if (!version) {
      return cb(new SemanticReleaseError(`There is no release with the dist-tag "${tag}" yet. Tag a version manually or define "fallbackTags".`, 'ENODISTTAG'));
    }

    cb(null, {
      version: version,
      gitHead: data.versions[version].gitHead,
      tag: tag
    })
  });
}