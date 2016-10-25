const relative = require('require-relative');
const series = require('run-series');

exports = module.exports = function (options) {
  const plugins = {
    analyzeCommits: exports.normalize(options.analyzeCommits, '@semantic-release/commit-analyzer'),
    getLastRelease: exports.normalize(options.getLastRelease, '@semantic-release/last-release-npm')
  }

  for (let plugin of ['verifyConditions', 'verifyRelease']) {
    if (!Array.isArray(options[plugin])) {
      plugins[plugin] = exports.normalize(
        options[plugin],
        plugin === 'verifyConditions' ? '@semantic-release/condition-travis' : './plugin-noop'
      )
      continue
    }

    plugins[plugin] = function (pluginOptions, cb) {
      series(options[plugin].map(step => exports.normalize(step, './plugin-noop').bind(null, pluginOptions)), cb)
    }
  }
  return plugins
}

exports.normalize = function (pluginConfig, fallback) {
  if (typeof pluginConfig === 'string') {
    return relative(pluginConfig).bind(null, {})
  }

  if (pluginConfig && (typeof pluginConfig.path === 'string')) {
    return relative(pluginConfig.path).bind(null, pluginConfig)
  }

  return require(fallback).bind(null, pluginConfig)
}
