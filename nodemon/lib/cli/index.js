const parse = require('./parse');

/**
 * Converts a command-line string into an array of arguments.
 * Supports grouping of quoted values.
 *
 * @param {string} input
 * @returns {string[]}
 */
function stringToArgs(input) {
  const args = [];
  const parts = input.split(' ');

  let isOpen = false;
  let quoteType = '';
  let buffer = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const firstChar = part.charAt(0);
    const lastChar = part.charAt(part.length - 1);

    // Opening quote
    if ((firstChar === '"' || firstChar === "'") && !isOpen) {
      isOpen = true;
      quoteType = firstChar;
      buffer = part.slice(1);
    }
    // Closing quote
    else if (isOpen && lastChar === quoteType) {
      isOpen = false;
      buffer += ' ' + part.slice(0, -1);
      args.push(buffer);
      buffer = '';
    }
    // Middle of quoted string
    else if (isOpen) {
      buffer += ' ' + part;
    }
    // Normal argument
    else {
      args.push(part);
    }
  }

  return args;
}

module.exports = {
  parse(argv) {
    if (typeof argv === 'string') {
      argv = stringToArgs(argv);
    }
    return parse(argv);
  },
};
