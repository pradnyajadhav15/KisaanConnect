'use strict';

const fill = require('fill-range');
const utils = require('./utils');

/**
 * Compiles an AST into a regex-friendly, optimized string.
 *
 * @param {Object} ast  - Parsed abstract syntax tree
 * @param {Object} options
 * @returns {String}
 */
const compile = (ast, options = {}) => {

  /**
   * Recursively walk through AST nodes and build the output string.
   *
   * @param {Object} node   - Current AST node
   * @param {Object} parent - Parent AST node
   * @returns {String}
   */
  const walk = (node, parent = {}) => {
    const parentInvalid = utils.isInvalidBrace(parent);
    const nodeInvalid = node.invalid === true && options.escapeInvalid === true;

    // If either the parent or the node is considered invalid
    const isInvalid = parentInvalid || nodeInvalid;

    // If escaping invalid braces is enabled, prefix with "\"
    const escapePrefix = options.escapeInvalid === true ? '\\' : '';

    let output = '';

    // Handle literal brace characters
    if (node.isOpen === true) {
      return escapePrefix + node.value;
    }

    if (node.isClose === true) {
      return escapePrefix + node.value;
    }

    // Handle brace-type tokens (open or close)
    if (node.type === 'open') {
      return isInvalid ? escapePrefix + node.value : '(';
    }

    if (node.type === 'close') {
      return isInvalid ? escapePrefix + node.value : ')';
    }

    // Handle commas inside brace sets
    if (node.type === 'comma') {
      // Avoid generating duplicate separators
      if (node.prev.type === 'comma') return '';

      return isInvalid ? node.value : '|';
    }

    // If node has direct string content, return it
    if (node.value) {
      return node.value;
    }

    // Handle numeric or character ranges `{1..5}`, `{a..e}`, etc.
    if (node.nodes && node.ranges > 0) {
      const args = utils.reduce(node.nodes);

      const range = fill(
        ...args,
        {
          ...options,
          wrap: false,
          toRegex: true,
          strictZeros: true
        }
      );

      if (range.length !== 0) {
        // Wrap in parentheses only if needed to preserve grouping
        return args.length > 1 && range.length > 1
          ? `(${range})`
          : range;
      }
    }

    // Handle nested nodes (recursive walk)
    if (node.nodes) {
      for (const child of node.nodes) {
        output += walk(child, node);
      }
    }

    return output;
  };

  return walk(ast);
};

module.exports = compile;
