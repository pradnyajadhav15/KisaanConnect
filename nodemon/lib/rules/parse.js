'use strict';
const fs = require('fs');

/**
 * Parse a nodemon config file.
 * Supports both:
 *   1. JSON format
 *   2. Legacy plain text format (one rule per line)
 *
 * @param {String} filename - path to config file
 * @param {Function} callback - called with (err, rules)
 */
function parse(filename, callback) {
  // Default rules object
  let rules = {
    ignore: [],
    watch: []
  };

  fs.readFile(filename, 'utf8', function (err, content) {
    if (err) {
      return callback(err);
    }

    let json = null;
    try {
      json = JSON.parse(content); // attempt to parse as JSON
    } catch (e) {
      // ignore, not JSON
    }

    if (json !== null) {
      // JSON config: extract ignore/watch arrays
      rules = {
        ignore: json.ignore || [],
        watch: json.watch || []
      };
      return callback(null, rules);
    }

    // Legacy plain-text config: split by lines
    return callback(null, { raw: content.split(/\n/) });
  });
}

module.exports = parse;
