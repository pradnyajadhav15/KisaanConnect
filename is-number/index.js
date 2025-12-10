'use strict';

/**
 * Check if a value is a valid number
 * @param {*} num
 * @returns {boolean}
 */
module.exports = function isNumber(num) {
  // If it's a number, check for NaN
  if (typeof num === 'number') {
    return num - num === 0; // NaN check
  }

  // If it's a non-empty string, check if it's finite
  if (typeof num === 'string' && num.trim() !== '') {
    return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
  }

  // Otherwise, not a number
  return false;
};
