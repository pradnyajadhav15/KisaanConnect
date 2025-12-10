const { exec } = require('child_process');
const tree = require('./tree');
const utils = require('./utils');

let hasPS = true;

// Check if the OS has the `ps` command (needed for psTree)
exec('ps', (error) => {
  hasPS = !error;
  module.exports.hasPS = hasPS;
});

/**
 * Get all child PIDs for a given PID.
 * Falls back to using OS-specific utilities if `ps` is not available.
 * 
 * @param {number|string} pid - The parent process ID
 * @param {function(Error|null, string[]|null)} callback - Callback with error or array of PIDs
 */
module.exports = function getChildPIDs(pid, callback) {
  // Ensure PID is a string
  if (typeof pid === 'number') pid = pid.toString();

  // If `ps` is available and not disabled via env
  if (hasPS && !process.env.NO_PS) {
    return tree(pid, callback);
  }

  // Fallback using utils to get process tree
  utils.getStat()
    .then(utils.tree)
    .then((treeData) => utils.pidsForTree(treeData, pid))
    .then((result) => {
      // Return only PID numbers
      const pids = result.map((p) => p.PID);
      callback(null, pids);
    })
    .catch((error) => callback(error));
};

// CLI support: node thisFile.js <pid>
if (!module.parent) {
  const pidArg = process.argv[2];
  module.exports(pidArg, (err, pids) => {
    if (err) console.error(err);
    else console.log(pids);
  });
}

// Export whether `ps` is available
module.exports.hasPS = hasPS;
