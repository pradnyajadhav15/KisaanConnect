'use strict';

const stringify = require('./lib/stringify');
const compile = require('./lib/compile');
const expand = require('./lib/expand');
const parse = require('./lib/parse');

/**
 * Main function: expands or compiles brace patterns.
 *
 * Examples:
 *   braces('{a,b,c}', { compile: true });  // ['(a|b|c)']
 *   braces('{a,b,c}');                     // ['a', 'b', 'c']
 *
 * @param {String|Array} input
 * @param {Object} options
 * @returns {Array}
 */
const braces = (input, options = {}) => {
  let results = [];

  if (Array.isArray(input)) {
    for (const pattern of input) {
      const expanded = braces.create(pattern, options);

      if (Array.isArray(expanded)) {
        results.push(...expanded);
      } else {
        results.push(expanded);
      }
    }
  } else {
    results = [].concat(braces.create(input, options));
  }

  // Remove duplicates if requested
  if (options.expand === true && options.nodupes === true) {
    results = [...new Set(results)];
  }

  return results;
};

/**
 * Parse a brace pattern into an AST.
 *
 * @param {String} input
 * @param {Object} options
 * @returns {Object}
 */
braces.parse = (input, options = {}) => {
  return parse(input, options);
};

/**
 * Convert AST back into a brace string.
 *
 * @param {String|Object} input
 * @param {Object} options
 */
braces.stringify = (input, options = {}) => {
  if (typeof input === 'string') {
    const ast = braces.parse(input, options);
    return stringify(ast, options);
  }
  return stringify(input, options);
};

/**
 * Compile a brace pattern into a regex-compatible string.
 *
 * @param {String|Object} input
 * @param {Object} options
 * @returns {Array}
 */
braces.compile = (input, options = {}) => {
  const ast = typeof input === 'string'
    ? braces.parse(input, options)
    : input;

  return compile(ast, options);
};

/**
 * Fully expand a brace pattern into all possible strings.
 *
 * @param {String|Object} input
 * @param {Object} options
 */
braces.expand = (input, options = {}) => {
  const ast = typeof input === 'string'
    ? braces.parse(input, options)
    : input;

  let result = expand(ast, options);

  // Filter empty strings if option enabled
  if (options.noempty === true) {
    result = result.filter(Boolean);
  }

  // Remove duplicates if enabled
  if (options.nodupes === true) {
    result = [...new Set(result)];
  }

  return result;
};

/**
 * Create either a compiled regex string or full expansion,
 * depending on provided options.
 *
 * @param {String} input
 * @param {Object} options
 */
braces.create = (input, options = {}) => {
  if (!input || input.length < 3) {
    return [input];
  }

  return options.expand === true
    ? braces.expand(input, options)
    : braces.compile(input, options);
};

module.exports = braces;
