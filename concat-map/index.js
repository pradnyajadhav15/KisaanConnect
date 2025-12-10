// Check if a value is an array
const isArray = Array.isArray || function (value) {
  return Object.prototype.toString.call(value) === '[object Array]';
};

/**
 * concatMap: maps each element using fn, then flattens arrays into the result
 * @param {Array} arr - input array
 * @param {Function} fn - mapping function (value, index) => value | Array
 * @returns {Array} flattened result
 */
function concatMap(arr, fn) {
  const result = [];

  for (let i = 0; i < arr.length; i++) {
    const mapped = fn(arr[i], i);

    if (isArray(mapped)) {
      // flatten arrays into result
      result.push(...mapped);
    } else {
      result.push(mapped);
    }
  }

  return result;
}

module.exports = concatMap;
