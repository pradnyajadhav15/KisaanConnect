'use strict';

/**
 * Check if a command-line flag exists in the given argv array.
 *
 * @param {string} flag - The flag to check, e.g., 'v' or 'version'.
 * @param {string[]} [argv=process.argv] - The argument array to check.
 * @returns {boolean} - True if the flag exists before any '--' terminator.
 */
module.exports = (flag, argv = process.argv) => {
  // Determine the correct prefix for the flag
  const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');

  // Full flag to search for
  const fullFlag = prefix + flag;

  // Find positions
  const flagPos = argv.indexOf(fullFlag);
  const terminatorPos = argv.indexOf('--');

  // Return true if flag exists and is before the '--' terminator (if any)
  return flagPos !== -1 && (terminatorPos === -1 || flagPos < terminatorPos);
};
