const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let root = null;

module.exports = version;
module.exports.pin = pin;

/**
 * Pin the current version to version.pinned
 * @returns {Promise<void>}
 */
function pin() {
  return version().then(v => {
    version.pinned = v;
  });
}

/**
 * Determine the current version of nodemon.
 * If in development, includes branch, commit, and dirty file count.
 * @param {Function} [callback] Optional callback for compatibility
 * @returns {Promise<string>}
 */
function version(callback) {
  const promise = findPackage(path.dirname(module.parent.filename))
    .then(dir => {
      const pkg = require(path.resolve(dir, 'package.json'));
      const v = pkg.version;

      if (v && v !== '0.0.0-development') {
        return v; // return version from package.json
      }

      // development mode: use git info
      root = dir;
      return Promise.all([branch().catch(() => 'master'), 
                          commit().catch(() => '<none>'), 
                          dirty().catch(() => 0)])
        .then(([branchName, commitHash, dirtyCount]) => {
          let ver = `${branchName}: ${commitHash}`;
          if (parseInt(dirtyCount, 10) !== 0) {
            ver += ` (${dirtyCount} dirty files)`;
          }
          return ver;
        });
    })
    .catch(err => {
      console.error(err.stack);
      throw err;
    });

  if (callback) {
    promise.then(res => callback(null, res), callback);
  }

  return promise;
}

/**
 * Recursively find the nearest package.json
 * @param {string} dir
 * @returns {Promise<string>} directory containing package.json
 */
function findPackage(dir) {
  if (dir === path.parse(dir).root) {
    return Promise.reject(new Error('package.json not found'));
  }

  return new Promise(resolve => {
    const pkgPath = path.resolve(dir, 'package.json');
    fs.stat(pkgPath, (err, stats) => {
      if (err || !stats) {
        return resolve(findPackage(path.resolve(dir, '..')));
      }
      resolve(dir);
    });
  });
}

/**
 * Run a shell command in the root directory
 * @param {string} cmd
 * @returns {Promise<string>}
 */
function command(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: root }, (err, stdout, stderr) => {
      const error = stderr.trim();
      if (error) return reject(new Error(error));
      resolve(stdout.trim());
    });
  });
}

function commit() {
  return command('git rev-parse HEAD');
}

function branch() {
  return command('git rev-parse --abbrev-ref HEAD');
}

function dirty() {
  return command(
    'expr $(git status --porcelain 2>/dev/null | egrep "^(M| M)" | wc -l)'
  );
}
