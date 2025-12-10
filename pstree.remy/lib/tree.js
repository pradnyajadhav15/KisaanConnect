const { spawn } = require('child_process');

/**
 * Get all child PIDs for a given root PID using `ps` (Unix systems)
 * @param {number|string} rootPid - The root process ID
 * @param {function(Error|null, number[]|null)} callback - Callback with error or array of child PIDs
 */
module.exports = function getChildPIDs(rootPid, callback) {
  // Set to track PIDs we care about (root PID + children)
  const pidsOfInterest = new Set([parseInt(rootPid, 10)]);
  let output = '';

  // Spawn the `ps` command to list all processes and their parent PIDs
  const ps = spawn('ps', ['-A', '-o', 'ppid,pid']);

  // Collect output data
  ps.stdout.on('data', (data) => {
    output += data.toString('ascii');
  });

  // When the command finishes, parse the output
  ps.on('close', () => {
    try {
      const childPIDs = output
        .split('\n')         // split into lines
        .slice(1)            // skip header
        .map((line) => line.trim())
        .reduce((acc, line) => {
          const [ppidStr, pidStr] = line.split(/\s+/);
          const ppid = parseInt(ppidStr, 10);

          if (pidsOfInterest.has(ppid)) {
            const pid = parseInt(pidStr, 10);
            acc.push(pid);
            pidsOfInterest.add(pid); // track this PID for further child detection
          }

          return acc;
        }, []);

      callback(null, childPIDs);
    } catch (err) {
      callback(err, null);
    }
  });

  // Handle errors from the spawned process
  ps.on('error', (err) => callback(err, null));
};
