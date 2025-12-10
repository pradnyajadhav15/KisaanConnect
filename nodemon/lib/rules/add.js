'use strict';

const utils = require('../utils');

// Regex patterns used internally
const reEscComments = /\\#/g;       // Escaped comments (like "\#")
const reUnescapeComments = /\^\^/g; // Placeholder for escaped comments
const reComments = /#.*$/;          // Standard comments
const reEscapeChars = /[.|\-[\]()\\]/g; // Characters to escape in regex
const reAsterisk = /\*/g;           // Asterisk wildcard

module.exports = add;

/**
 * Add a watch/ignore rule for nodemon.
 *
 * @param {Object} rules - Object containing `watch` and `ignore` arrays.
 * @param {String} which - Either "watch" or "ignore".
 * @param {String|RegExp|Array} rule - File pattern or array of patterns.
 */
function add(rules, which, rule) {
  // Validate first argument
  if (!{ ignore: 1, watch: 1 }[which]) {
    throw new Error('rules/index.js#add requires "ignore" or "watch" as the first argument');
  }

  // If rule is an array, recursively add each rule
  if (Array.isArray(rule)) {
    rule.forEach(r => add(rules, which, r));
    return;
  }

  // RegExp support is removed
  if (rule instanceof RegExp) {
    utils.log.error('RegExp format no longer supported, but globs are.');
    return;
  }

  // Remove comments and trim
  rule = (rule || '')
    .replace(reEscComments, '^^')   // temporarily replace escaped #
    .replace(reComments, '')        // remove actual comments
    .replace(reUnescapeComments, '#') // restore escaped #
    .trim();

  if (!rule) return; // ignore empty lines

  let regexp = false;

  // Old-style RegExp string support (deprecated)
  if (rule.startsWith(':')) {
    rule = rule.substring(1);
    utils.log.error('RegExp no longer supported: ' + rule);
    regexp = true;
  }

  if (!regexp) {
    // Add the glob pattern
    rules[which].push(rule);

    // Compile a single RegExp for all rules
    const re = rules[which]
      .map(r => r.replace(reEscapeChars, '\\$&').replace(reAsterisk, '.*'))
      .join('|');

    rules[which].re = new RegExp(re);
  }
}
