'use strict';

const fill = require('fill-range');
const stringify = require('./stringify');
const utils = require('./utils');

/**
 * Takes two arrays (queue + stash) and combines each item pairwise.
 * Used heavily to build expanded results.
 *
 * @param {Array|String} queue
 * @param {Array|String} stash
 * @param {Boolean} enclose  - Wrap stash values in braces if needed
 * @returns {Array}
 */
const append = (queue = '', stash = '', enclose = false) => {
  const result = [];

  // Normalize to arrays
  queue = [].concat(queue);
  stash = [].concat(stash);

  // If stash is empty, no combination needed
  if (!stash.length) return queue;

  // If queue is empty, stash forms the base set
  if (!queue.length) {
    return enclose
      ? utils.flatten(stash).map(val => `{${val}}`)
      : stash;
  }

  // Cross-combine queue and stash
  for (const item of queue) {
    if (Array.isArray(item)) {
      for (const value of item) {
        result.push(append(value, stash, enclose));
      }
    } else {
      for (let val of stash) {
        if (enclose && typeof val === 'string') {
          val = `{${val}}`;
        }
        result.push(
          Array.isArray(val) ? append(item, val, enclose) : item + val
        );
      }
    }
  }

  return utils.flatten(result);
};

/**
 * Expand an AST into a full set of brace expansions.
 *
 * @param {Object} ast
 * @param {Object} options
 * @returns {Array}
 */
const expand = (ast, options = {}) => {
  const rangeLimit =
    options.rangeLimit === undefined ? 1000 : options.rangeLimit;

  /**
   * Recursively walk AST nodes and build expansion queue.
   */
  const walk = (node, parent = {}) => {
    node.queue = [];

    // Identify the correct queue for performing expansions
    let p = parent;
    let q = parent.queue;

    // Walk upward until a brace or root node is found
    while (p.type !== 'brace' && p.type !== 'root' && p.parent) {
      p = p.parent;
      q = p.queue;
    }

    // Handle invalid nodes or literals like `$`
    if (node.invalid || node.dollar) {
      q.push(append(q.pop(), stringify(node, options)));
      return;
    }

    // Handle special case: empty braces {}
    if (node.type === 'brace' && !node.invalid && node.nodes.length === 2) {
      q.push(append(q.pop(), ['{}']));
      return;
    }

    // Handle numeric / alphabetic ranges like {1..5}, {a..z}
    if (node.nodes && node.ranges > 0) {
      const args = utils.reduce(node.nodes);

      if (utils.exceedsLimit(...args, options.step, rangeLimit)) {
        throw new RangeError(
          'expanded array length exceeds range limit. ' +
          'Use options.rangeLimit to increase or disable the limit.'
        );
      }

      let range = fill(...args, options);

      // Fallback to literal if range is empty
      if (range.length === 0) {
        range = stringify(node, options);
      }

      q.push(append(q.pop(), range));
      node.nodes = [];
      return;
    }

    // Handle normal brace blocks
    const enclose = utils.encloseBrace(node);
    let queue = node.queue;
    let block = node;

    // Find nearest brace or root block
    while (block.type !== 'brace' && block.type !== 'root' && block.parent) {
      block = block.parent;
      queue = block.queue;
    }

    // Iterate through inner nodes
    for (let i = 0; i < node.nodes.length; i++) {
      const child = node.nodes[i];

      // Comma indicates branch separation inside braces
      if (child.type === 'comma' && node.type === 'brace') {
        if (i === 1) queue.push(''); // ensure left branch exists
        queue.push('');
        continue;
      }

      // Closing brace → finalize this brace's expansion block
      if (child.type === 'close') {
        q.push(append(q.pop(), queue, enclose));
        continue;
      }

      // Literal content
      if (child.value && child.type !== 'open') {
        queue.push(append(queue.pop(), child.value));
        continue;
      }

      // Recurse into nested brace levels
      if (child.nodes) {
        walk(child, node);
      }
    }

    return queue;
  };

  // Flatten the final expanded structure
  return utils.flatten(walk(ast));
};

module.exports = expand;
