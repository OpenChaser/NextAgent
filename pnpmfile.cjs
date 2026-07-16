// pnpmfile.cjs - cross-version overrides for semver security fix
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'semver' && pkg.version) {
        const parts = pkg.version.split('.');
        const major = parseInt(parts[0]) || 0;
        const minor = parseInt(parts[1]) || 0;
        const patch = parseInt(parts[2]) || 0;
        if (major < 5 || (major === 5 && minor < 7) || (major === 5 && minor === 7 && patch < 2)) {
          pkg.version = '5.7.2';
        }
      }
      return pkg;
    }
  }
};
