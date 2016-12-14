const url = require('url')

const gitHead = require('git-head')
const GitHubApi = require('github')
const fromUrl = require('hosted-git-info').fromUrl
const through = require('through2');

module.exports = function (config, cb) {
  const pkg = config.pkg
  const options = config.options
  const ghConfig = options.githubUrl ? url.parse(options.githubUrl) : {}

  const github = new GitHubApi({
    version: '3.0.0',
    port: ghConfig.port,
    protocol: (ghConfig.protocol || '').split(':')[0] || null,
    host: ghConfig.hostname,
    pathPrefix: options.githubApiPathPrefix || null
  })

  let body = ""
  require('conventional-changelog')({
    preset: 'angular',
    pkg: pkg,
  })
    .on('error', function (err) {
      cb(err)
    })
    .pipe(through(function (chunk, enc, cb) {
      body += chunk.toString()
      cb()
    }, function () {
      gitHead(function (err, hash) {
        if (err) return cb(err)

        const ghRepo = fromUrl(pkg.repository.url)
        const release = {
          owner: ghRepo.user,
          repo: ghRepo.project,
          name: pkg.version,
          tag_name: `v${pkg.version}`,
          target_commitish: hash,
          draft: options.debug,
          body: body,
          prerelease: process.env.GH_RELEASE_PRERELEASE === "true" || (pkg.publishConfig || {}).tag === "next"
        }

        if (options.debug && !options.githubToken) {
          return cb(null, false, release)
        }

        github.authenticate({
          type: 'oauth',
          token: options.githubToken
        })

        github.repos.createRelease(release, function (err) {
          if (err) return cb(err)

          cb(null, true, release)
        })
      })
    }))
}
