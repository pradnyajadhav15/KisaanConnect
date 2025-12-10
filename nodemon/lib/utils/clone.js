'use strict';

module.exports = clone;

/**
 * Deep clone an object, array, or Date.
 * Supports primitive types, Date, Array, and plain Objects.
 * Throws an error for unsupported types.
 *
 * @param {*} obj - The object to clone
 * @returns {*} - A deep copy of the object
 */
function clone(obj) {
  // Handle null, undefined, or primitive types
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => clone(item));
  }

  // Handle plain Object
  if (obj instanceof Object) {
    const copy = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = clone(obj[key]);
      }
    }
    return copy;
  }

  throw new Error("Unable to clone object! Type isn't supported.");
}
