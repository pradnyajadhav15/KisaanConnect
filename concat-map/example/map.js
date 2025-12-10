// Import the concatMap function from one directory up
const concatMap = require('../');

// Our original array
const numbers = [1, 2, 3, 4, 5, 6];

// Use concatMap to transform the array
// For each number:
//   - If it's odd → return an array: [x - 0.1, x, x + 0.1]
//   - If it's even → return an empty array (meaning: skip it)
const result = concatMap(numbers, function (num) {
  const isOdd = num % 2 !== 0;

  if (isOdd) {
    return [num - 0.1, num, num + 0.1];
  } else {
    return [];  // no output for even numbers
  }
});

// Print the final flattened array
console.dir(result);
