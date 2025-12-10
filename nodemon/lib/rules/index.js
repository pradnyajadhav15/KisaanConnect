'use strict';

const utils = require('../utils');
const add = require('./add');
const parse = require('./parse');

// Main rules object that stores ignore and watch patterns
const rules = {
  ignore: [],
  watch: []
};

/**
 * Load a nodemon configuration file and populate rules
 *
 * @param {String} filename - path to the config file
 * @param {Function} callback - called with (err, rules)
 */
function load(filename, callback) {
  parse(filename, (err, result) => {
    if (err) {
      utils.log.error(err);
      return callback(err);
    }

    if (result.raw) {
      // If raw rules exist, treat them as ignore rules
      result.raw.forEach(add.bind(null, rules, 'ignore'));
    } else {
      // Otherwise, process ignore and watch separately
      result.ignore.forEach(add.bind(null, rules, 'ignore'));
      result.watch.forEach(add.bind(null, rules, 'watch'));
    }

    callback(null, rules);
  });
}

module.exports = {
  // Reset rules (used mainly for testing)
  reset: function () {
    rules.ignore.length = 0;
    rules.watch.length = 0;
    delete rules.ignore.re;
    delete rules.watch.re;
  },

  // Load rules from a file
  load: load,

  // Ignore rules helpers
  ignore: {
    test: add.bind(null, rules, 'ignore'),
    add: add.bind(null, rules, 'ignore'),
  },

  // Watch rules helpers
  watch: {
    test: add.bind(null, rules, 'watch'),
    add: add.bind(null, rules, 'watch'),
  },

  // Generic add function
  add: add.bind(null, rules),

  // Export the rules object itself
  rules: rules
};
