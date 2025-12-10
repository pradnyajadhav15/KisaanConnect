const concatMap = require('../');
const test = require('tape');

// Test 1: Filtering and transforming numbers
test('filter odd numbers and map to nearby values', function (t) {
    const numbers = [1, 2, 3, 4, 5, 6];
    const indices = [];

    const result = concatMap(numbers, (num, idx) => {
        indices.push(idx);
        // For odd numbers, return num-0.1, num, num+0.1; otherwise, return empty array
        return num % 2 ? [num - 0.1, num, num + 0.1] : [];
    });

    t.same(result, [0.9, 1, 1.1, 2.9, 3, 3.1, 4.9, 5, 5.1]);
    t.same(indices, [0, 1, 2, 3, 4, 5]);
    t.end();
});

// Test 2: Transforming specific elements
test('replace "b" with multiple "B"s', function (t) {
    const letters = ['a', 'b', 'c', 'd'];

    const result = concatMap(letters, (char) => {
        return char === 'b' ? ['B', 'B', 'B'] : [char];
    });

    t.same(result, ['a', 'B', 'B', 'B', 'c', 'd']);
    t.end();
});

// Test 3: Scalars handling
test('mix scalars and arrays', function (t) {
    const letters = ['a', 'b', 'c', 'd'];

    const result = concatMap(letters, (char) => {
        // Return array for 'b', scalar for others
        return char === 'b' ? ['B', 'B', 'B'] : char;
    });

    t.same(result, ['a', 'B', 'B', 'B', 'c', 'd']);
    t.end();
});

// Test 4: Callback returns undefined
test('callback returns undefined', function (t) {
    const letters = ['a', 'b', 'c', 'd'];

    const result = concatMap(letters, () => undefined);

    t.same(result, [undefined, undefined, undefined, undefined]);
    t.end();
});
