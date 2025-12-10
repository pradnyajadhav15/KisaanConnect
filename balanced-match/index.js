'use strict';

/**
 * Find the first balanced pair of strings (or characters) in a given string.
 * Works for nested structures and identical start/end markers (like quotes).
 *
 * @param {string|RegExp} open - Opening string or regex.
 * @param {string|RegExp} close - Closing string or regex.
 * @param {string} str - Input string to search.
 * @returns {object|null} - Balanced result with start, end, pre, body, post, or null if not found.
 */
function balanced(open, close, str) {
  // Convert regex to string if needed
  if (open instanceof RegExp) open = maybeMatch(open, str);
  if (close instanceof RegExp) close = maybeMatch(close, str);

  const rangeIndices = getRange(open, close, str);

  if (!rangeIndices) return null;

  const [start, end] = rangeIndices;

  return {
    start,
    end,
    pre: str.slice(0, start),
    body: str.slice(start + open.length, end),
    post: str.slice(end + close.length),
  };
}

/**
 * Helper: Match regex in string and return the first match as string.
 */
function maybeMatch(regex, str) {
  const match = str.match(regex);
  return match ? match[0] : null;
}

/**
 * Find the start and end indices of the first balanced occurrence.
 *
 * @param {string} open
 * @param {string} close
 * @param {string} str
 * @returns {[number, number]|null} - [startIndex, endIndex] or null
 */
function getRange(open, close, str) {
  let openStack = [];
  let left = Infinity;
  let right = -1;

  let ai = str.indexOf(open);
  let bi = str.indexOf(close, ai + 1);

  // If either not found, return null
  if (ai < 0 || bi < 0) return null;

  // Special case: identical open/close (like quotes)
  if (open === close) return [ai, bi];

  let i = ai;

  while (i >= 0) {
    if (i === ai) {
      // Found an opening
      openStack.push(i);
      ai = str.indexOf(open, i + 1);
    } else if (openStack.length === 1) {
      // Balanced pair found
      return [openStack.pop(), bi];
    } else {
      // Nested structure
      const beg = openStack.pop();
      if (beg < left) {
        left = beg;
        right = bi;
      }
      bi = str.indexOf(close, i + 1);
    }

    // Choose next index to examine
    if (ai < 0 && bi < 0) break;
    i = ai >= 0 && (ai < bi || bi < 0) ? ai : bi;
  }

  // Fallback for nested but unclosed
  if (openStack.length) return [left, right];

  return null;
}

// Expose range function as well
balanced.range = getRange;

module.exports = balanced;
