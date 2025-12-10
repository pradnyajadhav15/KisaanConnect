/*!
 * is-extglob <https://github.com/jonschlinkert/is-extglob>
 *
 * Copyright (c) 2014-2016, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

/**
 * Check if a string contains an extended glob pattern.
 *
 * @param {string} str
 * @returns {boolean} True if the string contains an extglob, false otherwise
 */
module.exports = function isExtglob(str) {
  if (typeof str !== 'string' || str === '') return false;

  let match;
  const regex = /(\\).|([@?!+*]\(.*\))/g;

  while ((match = regex.exec(str))) {
    // If the second capturing group matches, it's an extglob
    if (match[2]) return true;

    // Move past the current match and continue
    str = str.slice(match.index + match[0].length);
  }

  return false;
};
