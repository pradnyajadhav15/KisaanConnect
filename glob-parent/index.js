'use strict';

const isGlob = require('is-glob');
const { posix: pathPosix } = require('path');
const isWin32 = require('os').platform() === 'win32';

const SLASH = '/';
const BACKSLASH_REGEX = /\\/g;
const ENCLOSURE_REGEX = /[\{\[].*[\}\]]$/;
const GLOBBY_REGEX = /(^|[^\\])([\{\[]|\([^\)]+$)/;
const ESCAPED_CHARS_REGEX = /\\([\!\*\?\|\[\]\(\)\{\}])/g;

/**
 * Get the non-glob parent path of a given path string.
 * 
 * @param {string} str - The path string.
 * @param {Object} opts - Options.
 * @param {boolean} [opts.flipBackslashes=true] - Convert Windows backslashes to forward slashes.
 * @returns {string} - The parent path without glob patterns.
 */
function globParent(str, opts = {}) {
  const options = { flipBackslashes: true, ...opts };

  // Convert Windows backslashes to forward slashes if needed
  if (options.flipBackslashes && isWin32 && !str.includes(SLASH)) {
    str = str.replace(BACKSLASH_REGEX, SLASH);
  }

  // If path ends with an enclosure like {a,b} or [1-9], append a slash
  if (ENCLOSURE_REGEX.test(str)) {
    str += SLASH;
  }

  // Add a dummy file to preserve full path
  str += 'a';

  // Remove trailing path segments that are globs
  while (isGlob(str) || GLOBBY_REGEX.test(str)) {
    str = pathPosix.dirname(str);
  }

  // Remove escape characters and return
  return str.replace(ESCAPED_CHARS_REGEX, '$1');
}

module.exports = globParent;
