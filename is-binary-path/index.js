'use strict';

const path = require('path');
const binaryExtensions = require('binary-extensions');

// Convert the array of binary extensions into a Set for faster lookup
const extensionsSet = new Set(binaryExtensions);

/**
 * Check if a file path points to a binary file.
 *
 * @param {string} filePath - The path to the file
 * @returns {boolean} True if the file has a binary extension, false otherwise
 */
module.exports = function isBinaryPath(filePath) {
  // Get the file extension, remove the leading dot, convert to lowercase
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return extensionsSet.has(ext);
};
