#!/usr/bin/env node

const fs = require('fs')
const fse = require('fs-extra-p')
const Promise = require('bluebird-lst-c')
const ini = require('ini')
const path = require('path')
const url = require('url')
const debug = require('debug')('semantic-release')
const fromUrl = require('hosted-git-info').fromUrl

const env = process.env
const packageData = fixRepositoryField(JSON.parse(fs.readFileSync('./package.json')))

function fixRepositoryField(data) {
  if (data.repositories) {
    data.repository = data.repositories[0]
  }

  if (!data.repository) {
    return data
  }

  if (typeof data.repository === "string") {
    data.repository = {
      type: "git",
      url: data.repository
    }
  }

  const r = data.repository.url
  if (r) {
    const hosted = fromUrl(r)
    if (hosted) {
      data.repository.url = hosted.getDefaultRepresentation() == "shortcut" ? hosted.https() : hosted.toString()
    }
  }

  return data
}

const options = Object.assign({}, packageData.release, {
  branch: env.SR_BRANCH || 'master',
  fallbackTags: {
    next: 'latest'
  },
  githubToken: env.GH_TOKEN || env.GITHUB_TOKEN,
  githubUrl: env.GH_URL
})

const plugins = require('../src/lib/plugins')(options)

const registry = url.format(url.parse(getRegistry(packageData)))
const tag = (packageData.publishConfig || {}).tag || 'latest'

const config = {
  env: env,
  pkg: packageData,
  tag: tag,
  registry: registry,
  options: options,
  plugins: plugins,
  auth: {
    token: env.NPM_TOKEN
  }
}

const errors = verify(packageData)
if (errors.length > 0) {
  for (let error of errors) {
    console.error(error)
  }
  process.exit(1)
}

const command = process.argv.slice(2)[0]
let promise = null
if (command === 'pre') {
  promise = pre()
}
else if (command === 'post') {
  promise = Promise.promisify(require('../src/post'))(config)
    .then(function (published, release) {
      debug(`${published ? 'Published' : 'Generated'} release notes: ${release}`)
    })
}
else {
  throw new Error(`Command "${command}" not recognized. Use either "pre" or "post"`)
}

promise
  .catch(error => {
    console.error(error.stack || error)
    process.exit(1)
  })

function pre() {
  return (process.env.CI ? fse.writeFile(path.join(require("os").homedir(), '.npmrc'), `${toNerfDart(registry)}:_authToken=\${NPM_TOKEN}\n`) : Promise.resolve())
    .then(() => Promise.promisify(require('../src/pre'))(config))
    .then(release => {
      debug(`Determined version ${release.version} as "${tag}"`)
      if (options.debug) {
        console.error('pre', 'Not publishing in debug mode', release)
        process.exit(1)
      }

      try {
        const shrinkwrap = JSON.parse(fs.readFileSync('./npm-shrinkwrap.json'))
        shrinkwrap.version = release.version
        fs.writeFileSync('./npm-shrinkwrap.json', JSON.stringify(shrinkwrap, null, 2))
        debug(`Wrote version ${release.version}to npm-shrinkwrap.json.`)
      }
      catch (e) {
        debug('Couldn\'t find npm-shrinkwrap.json.')
      }

      debug(`Wrote version ${release.version} to package.json.`)
      return fse.writeFile('./package.json', JSON.stringify(Object.assign(packageData, {
        version: release.version
      }), null, 2))
    })
}

function toNerfDart(uri) {
  const parsed = url.parse(uri)
  delete parsed.protocol
  delete parsed.auth
  delete parsed.query
  delete parsed.search
  delete parsed.hash
  return url.resolve(url.format(parsed), '.')
}

function getRegistry(packageData) {
  if (packageData.publishConfig && packageData.publishConfig.registry) {
    return packageData.publishConfig.registry
  }
  else {
    return 'https://registry.npmjs.org/'
  }
}

function verify(packageData) {
  const errors = []

  if (!packageData.name) {
    errors.push('No "name" found in package.json.')
  }

  if (!packageData.repository || !packageData.repository.url) {
    errors.push('No "repository" found in package.json.')
  }

  if (config.options.debug) {
    return errors
  }

  if ((process.env.CI || "").toLowerCase() === "true" && !process.env.NPM_TOKEN) {
    errors.push('No npm token specified')
  }

  return errors
}