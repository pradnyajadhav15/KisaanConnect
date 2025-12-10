"use strict";

/**
 * Check whether a value is an integer.
 * Accepts both numbers and numeric strings.
 */
exports.isInteger = (num) => {
  if (typeof num === "number") {
    return Number.isInteger(num);
  }

  if (typeof num === "string" && num.trim() !== "") {
    return Number.isInteger(Number(num));
  }

  return false;
};

/**
 * Find the first child node with the given type.
 */
exports.find = (node, type) => {
  return node.nodes.find((child) => child.type === type);
};

/**
 * Check if a range expansion would exceed the allowed limit.
 */
exports.exceedsLimit = (min, max, step = 1, limit) => {
  if (limit === false) return false;
  if (!exports.isInteger(min) || !exports.isInteger(max)) return false;

  const total = (Number(max) - Number(min)) / Number(step);
  return total >= limit;
};

/**
 * Escape a node by prefixing its value with a backslash.
 * This is used to turn brace characters into literal text.
 */
exports.escapeNode = (block, index = 0, type) => {
  const node = block.nodes[index];
  if (!node) return;

  const isTargetType =
    (type && node.type === type) ||
    node.type === "open" ||
    node.type === "close";

  if (isTargetType && node.escaped !== true) {
    node.value = "\\" + node.value;
    node.escaped = true;
  }
};

/**
 * Mark a brace as literal if it contains no ranges or commas.
 * Such braces must appear as `{text}` literally rather than expand.
 */
exports.encloseBrace = (node) => {
  if (node.type !== "brace") return false;

  const hasNoContent = (node.commas >> 0) + (node.ranges >> 0) === 0;

  if (hasNoContent) {
    node.invalid = true;
    return true;
  }

  return false;
};

/**
 * Check if a brace node is considered invalid.
 */
exports.isInvalidBrace = (node) => {
  if (node.type !== "brace") return false;

  // Dollar-braces `${}` or previously marked invalid
  if (node.invalid === true || node.dollar) return true;

  const hasNoContent = (node.commas >> 0) + (node.ranges >> 0) === 0;
  if (hasNoContent) {
    node.invalid = true;
    return true;
  }

  // Braces missing open or close are invalid
  if (node.open !== true || node.close !== true) {
    node.invalid = true;
    return true;
  }

  return false;
};

/**
 * Check whether a node represents an opening or closing brace.
 */
exports.isOpenOrClose = (node) => {
  if (node.type === "open" || node.type === "close") return true;
  return node.open === true || node.close === true;
};

/**
 * Reduce text and range nodes into plain values.
 * Converts range nodes into text nodes for consistency.
 */
exports.reduce = (nodes) => {
  return nodes.reduce((acc, node) => {
    if (node.type === "text") {
      acc.push(node.value);
    }

    if (node.type === "range") {
      node.type = "text";
    }

    return acc;
  }, []);
};

/**
 * Flatten deeply nested arrays into a single-level array.
 */
exports.flatten = (...items) => {
  const output = [];

  const flattenInner = (arr) => {
    for (const item of arr) {
      if (Array.isArray(item)) {
        flattenInner(item);
      } else if (item !== undefined) {
        output.push(item);
      }
    }
    return output;
  };

  return flattenInner(items);
};
