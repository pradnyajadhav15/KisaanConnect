'use strict';

const clone = require('./clone');

/**
 * Deep merge of two objects
 * 
 * @param {Object} source - the source object (base)
 * @param {Object} target - the target object (to merge into source)
 * @param {Object} [result] - optional result object (for recursion)
 * @returns {Object} - merged object
 */
function merge(source, target, result) {
  // Initialize result as a clone of source if not provided
  if (result === undefined) {
    result = clone(source);
  }

  // Helper function to check if types match (including arrays)
  function typesMatch(a, b) {
    return typeof a === typeof b && Array.isArray(a) === Array.isArray(b);
  }

  // Merge missing properties from target into result
  Object.getOwnPropertyNames(target).forEach((key) => {
    if (source[key] === undefined) {
      result[key] = target[key];
    }
  });

  // Merge existing properties where types match
  Object.getOwnPropertyNames(source).forEach((key) => {
    const value = source[key];

    if (target[key] && typesMatch(value, target[key])) {
      // Replace empty string with target value
      if (value === '') {
        result[key] = target[key];
      }

      // Merge arrays
      if (Array.isArray(value)) {
        if (value.length === 0 && target[key].length) {
          result[key] = target[key].slice(); // copy array
        }
      } 
      // Merge objects recursively
      else if (typeof value === 'object') {
        result[key] = merge(value, target[key]);
      }
    }
  });

  return result;
}

module.exports = merge;
