module.exports = function (pkg, conf) {
  if (pkg.publishConfig && pkg.publishConfig.registry) return pkg.publishConfig.registry

  if (pkg.name[0] !== '@') return conf['registry'] || 'https://registry.npmjs.org/'

  const scope = pkg.name.split('/')[0]
  const scopedRegistry = conf[scope + '/registry']

  if (scopedRegistry) return scopedRegistry

  return conf['registry'] || 'https://registry.npmjs.org/'
}
