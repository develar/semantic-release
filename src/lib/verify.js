module.exports = function (config) {
  const pkg = config.pkg
  const errors = []

  if (!pkg.name) {
    errors.push('No "name" found in package.json.')
  }

  if (!pkg.repository || !pkg.repository.url) {
    errors.push('No "repository" found in package.json.')
  }

  if (config.options.debug) {
    return errors
  }

  if ((process.env.CI || "").toLowerCase() === "true" && !config.env.NPM_TOKEN) {
    errors.push('No npm token specified')
  }

  return errors
}
