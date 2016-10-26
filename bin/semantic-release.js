#!/usr/bin/env node

const fs = require('fs')
const ini = require('ini')
const path = require('path')
const url = require('url')

const _ = require('lodash')
const log = require('npmlog')
const nopt = require('nopt')
const rc = require('rc')
const normalizeData = require('normalize-package-data')

log.heading = 'semantic-release'
const env = process.env
const pkg = JSON.parse(fs.readFileSync('./package.json'))
const originalPkg = _.cloneDeep(pkg)
normalizeData(pkg)
const knownOptions = {
  branch: String,
  debug: Boolean,
  'github-token': String,
  'github-url': String,
  'analyze-commits': [path, String],
  'generate-notes': [path, String],
  'verify-conditions': [path, String],
  'verify-release': [path, String]
}
const options = _.defaults(
  _.mapKeys(nopt(knownOptions), function (value, key) {
    return _.camelCase(key)
  }),
  pkg.release,
  {
    branch: 'master',
    fallbackTags: {
      next: 'latest'
    },
    debug: !env.CI,
    githubToken: env.GH_TOKEN || env.GITHUB_TOKEN,
    githubUrl: env.GH_URL
  }
)
const plugins = require('../src/lib/plugins')(options)

const conf = rc('npm', {})
const npm = {
  auth: {
    token: env.NPM_TOKEN
  },
  cafile: conf['cafile'],
  loglevel: conf['loglevel'],
  registry: require('../src/lib/get-registry')(pkg, conf),
  tag: (pkg.publishConfig || {}).tag || conf['tag'] || 'latest'
}

// normalize trailing slash
npm.registry = url.format(url.parse(npm.registry))

log.level = npm.loglevel

const config = {
  env: env,
  pkg: pkg,
  options: options,
  plugins: plugins,
  npm: npm
}

const hide = {}
if (options.githubToken) hide.githubToken = '***'

log.verbose('init', 'options:', Object.assign({}, options, hide))
log.verbose('init', 'Verifying config.')

const errors = require('../src/lib/verify')(config)
errors.forEach(function (err) {
  log.error('init', err.message + ' ' + err.code)
})
if (errors.length) process.exit(1)

if (options.argv.remain[0] === 'pre') {
  log.verbose('pre', 'Running pre-script.')
  log.verbose('pre', 'Veriying conditions.')

  plugins.verifyConditions(config, function (err) {
    if (err) {
      log[options.debug ? 'warn' : 'error']('pre', err.message)
      if (!options.debug) process.exit(1)
    }

    const nerfDart = require('nerf-dart')(npm.registry)
    let wroteNpmRc = false

    if (env.NPM_TOKEN) {
      conf.set(nerfDart + ':_authToken', '${NPM_TOKEN}', 'project')
      wroteNpmRc = true
    }

    fs.writeFile('.npmrc', ini.encode(conf), function (error) {
      if (error) return log.error('pre', 'Failed to save npm config.', error)

      if (wroteNpmRc) log.verbose('pre', 'Wrote authToken to .npmrc.')

      require('../src/pre')(config, function (error, release) {
        if (error) {
          log.error('pre', 'Failed to determine new version: ' + (error.stack || error))
          process.exit(1)
        }

        const message = 'Determined version ' + release.version + ' as "' + npm.tag + '".'
        log.verbose('pre', message)

        if (options.debug) {
          log.error('pre', message + ' Not publishing in debug mode.', release)
          process.exit(1)
        }

        try {
          const shrinkwrap = JSON.parse(fs.readFileSync('./npm-shrinkwrap.json'))
          shrinkwrap.version = release.version
          fs.writeFileSync('./npm-shrinkwrap.json', JSON.stringify(shrinkwrap, null, 2))
          log.verbose('pre', 'Wrote version ' + release.version + 'to npm-shrinkwrap.json.')
        } catch (e) {
          log.silly('pre', 'Couldn\'t find npm-shrinkwrap.json.')
        }

        fs.writeFileSync('./package.json', JSON.stringify(Object.assign(originalPkg, {
          version: release.version
        }), null, 2))

        log.verbose('pre', 'Wrote version ' + release.version + ' to package.json.')
      })
    })
  })
} else if (options.argv.remain[0] === 'post') {
  log.verbose('post', 'Running post-script.')

  require('../src/post')(config, function (err, published, release) {
    if (err) {
      log.error('post', 'Failed to publish release notes.', err)
      process.exit(1)
    }

    log.verbose('post', (published ? 'Published' : 'Generated') + ' release notes.', release)
  })
} else {
  log.error('post', 'Command "' + options.argv.remain[0] + '" not recognized. Use either "pre" or "post"')
}
