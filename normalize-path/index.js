/*!
 * normalize-path <https://github.com/jonschlinkert/normalize-path>
 *
 * Converts Windows-style backslashes to POSIX-style forward slashes.
 * Optionally strips trailing slashes.
 * 
 * MIT License
 */

module.exports = function normalizePath(path, stripTrailing = true) {
  if (typeof path !== 'string') {
    throw new TypeError('expected path to be a string');
  }

  // Handle root paths
  if (path === '\\' || path === '/') return '/';
  if (path.length <= 1) return path;

  let prefix = '';

  // Handle Windows UNC and device paths (\\?\ or \\.\)
  if (path.length > 4 && path[3] === '\\') {
    const ch = path[2];
    if ((ch === '?' || ch === '.') && path.startsWith('\\\\')) {
      path = path.slice(2); // Remove leading slashes
      prefix = '//';         // Keep correct UNC prefix
    }
  }

  // Split on both forward and backslashes
  const segments = path.split(/[/\\]+/);

  // Remove trailing empty segment unless stripTrailing is false
  if (stripTrailing !== false && segments[segments.length - 1] === '') {
    segments.pop();
  }

  // Join with POSIX forward slashes
  return prefix + segments.join('/');
};
