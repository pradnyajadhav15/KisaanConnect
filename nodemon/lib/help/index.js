const fs = require('fs');
const path = require('path');
const supportsColor = require('supports-color');

module.exports = help;

// Use ANSI highlight sequences only if the terminal supports color
const highlight = supportsColor.stdout ? '\x1B[$1m' : '';

/**
 * Returns the help text for a given CLI item
 * @param {string|boolean} item - The CLI command or option to get help for
 * @returns {string} Help text
 */
function help(item) {
  // Default to 'help' if no item is provided or used as -h/--help
  if (!item || item === true) {
    item = 'help';
  }

  // Remove all non-alphabetic characters
  item = item.replace(/[^a-z]/gi, '');

  try {
    const filePath = path.join(__dirname, '..', '..', 'doc', 'cli', `${item}.txt`);
    let body = fs.readFileSync(filePath, 'utf8');

    // Replace ANSI escape sequences with highlight code if supported
    return body.replace(/\\x1B\[(.)m/g, highlight);
  } catch (err) {
    return `"${item}" help can't be found`;
  }
}
