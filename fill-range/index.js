/*!
 * fill-range <https://github.com/jonschlinkert/fill-range>
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

const util = require('util');
const toRegexRange = require('to-regex-range');

// Helpers
const isObject = val => val && typeof val === 'object' && !Array.isArray(val);
const isValidValue = val => typeof val === 'number' || (typeof val === 'string' && val !== '');
const isNumber = num => Number.isInteger(+num);
const zeros = str => {
  str = String(str);
  if (str[0] === '-') str = str.slice(1);
  if (str === '0') return false;
  let i = 0;
  while (str[i] === '0') i++;
  return i > 0;
};
const transform = toNumber => val => toNumber === true ? Number(val) : String(val);
const rangeError = (...args) => new RangeError('Invalid range arguments: ' + util.inspect(...args));

const invalidRange = (start, end, options) => options.strictRanges ? rangeError([start, end]) : [];
const invalidStep = (step, options) => options.strictRanges ? new TypeError(`Expected step "${step}" to be a number`) : [];

// Padding helpers
const pad = (input, maxLength, toNumber) => {
  let negative = input[0] === '-' ? '-' : '';
  if (negative) input = input.slice(1);
  input = negative + input.padStart(negative ? maxLength - 1 : maxLength, '0');
  return toNumber === false ? String(input) : input;
};

const toMaxLen = (input, maxLength) => {
  let negative = input[0] === '-' ? '-' : '';
  if (negative) {
    input = input.slice(1);
    maxLength--;
  }
  while (input.length < maxLength) input = '0' + input;
  return negative + input;
};

// Sequence generation for regex
const toSequence = (parts, options, maxLen) => {
  parts.negatives.sort((a, b) => a - b);
  parts.positives.sort((a, b) => a - b);

  const prefix = options.capture ? '' : '?:';
  const positives = parts.positives.map(v => toMaxLen(String(v), maxLen)).join('|');
  const negatives = parts.negatives.length
    ? `-(${prefix}${parts.negatives.map(v => toMaxLen(String(v), maxLen)).join('|')})`
    : '';

  let result = positives && negatives ? `${positives}|${negatives}` : positives || negatives;
  return options.wrap ? `(${prefix}${result})` : result;
};

// Convert numbers or letters to regex range
const toRange = (a, b, isNumbers, options) => {
  if (isNumbers) return toRegexRange(a, b, { wrap: false, ...options });
  const start = String.fromCharCode(a);
  return a === b ? start : `[${start}-${String.fromCharCode(b)}]`;
};

const toRegex = (start, end, options) => {
  if (Array.isArray(start)) {
    const wrap = options.wrap;
    const prefix = options.capture ? '' : '?:';
    return wrap ? `(${prefix}${start.join('|')})` : start.join('|');
  }
  return toRegexRange(start, end, options);
};

// Fill numbers
const fillNumbers = (start, end, step = 1, options = {}) => {
  let a = Number(start);
  let b = Number(end);

  if (!Number.isInteger(a) || !Number.isInteger(b)) return options.strictRanges ? rangeError([start, end]) : [];

  a = a === 0 ? 0 : a;
  b = b === 0 ? 0 : b;

  const descending = a > b;
  const startStr = String(start);
  const endStr = String(end);
  const stepStr = String(step);
  step = Math.max(Math.abs(step), 1);

  const padded = zeros(startStr) || zeros(endStr) || zeros(stepStr);
  const maxLen = padded ? Math.max(startStr.length, endStr.length, stepStr.length) : 0;
  const toNumber = !padded && options.stringify !== true;
  const format = options.transform || transform(toNumber);

  if (options.toRegex && step === 1) {
    return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
  }

  const parts = { negatives: [], positives: [] };
  const range = [];
  const pushPart = num => parts[num < 0 ? 'negatives' : 'positives'].push(Math.abs(num));

  let index = 0;
  while (descending ? a >= b : a <= b) {
    if (options.toRegex && step > 1) pushPart(a);
    else range.push(pad(format(a, index), maxLen, toNumber));
    a = descending ? a - step : a + step;
    index++;
  }

  if (options.toRegex) return step > 1 ? toSequence(parts, options, maxLen) : toRegex(range, null, { wrap: false, ...options });
  return range;
};

// Fill letters
const fillLetters = (start, end, step = 1, options = {}) => {
  if ((!isNumber(start) && start.length > 1) || (!isNumber(end) && end.length > 1)) return invalidRange(start, end, options);

  const format = options.transform || (val => String.fromCharCode(val));
  let a = start.charCodeAt(0);
  let b = end.charCodeAt(0);
  const descending = a > b;
  const min = Math.min(a, b);
  const max = Math.max(a, b);

  if (options.toRegex && step === 1) return toRange(min, max, false, options);

  const range = [];
  let index = 0;
  while (descending ? a >= b : a <= b) {
    range.push(format(a, index));
    a = descending ? a - step : a + step;
    index++;
  }

  return options.toRegex ? toRegex(range, null, { wrap: false, options }) : range;
};

// Main fill function
const fill = (start, end, step, options = {}) => {
  if (end == null && isValidValue(start)) return [start];
  if (!isValidValue(start) || !isValidValue(end)) return invalidRange(start, end, options);

  if (typeof step === 'function') return fill(start, end, 1, { transform: step });
  if (isObject(step)) return fill(start, end, 0, step);

  const opts = { ...options };
  if (opts.capture) opts.wrap = true;
  step = step || opts.step || 1;

  if (!isNumber(step)) return step != null && !isObject(step) ? invalidStep(step, opts) : fill(start, end, 1, step);
  return isNumber(start) && isNumber(end)
    ? fillNumbers(start, end, step, opts)
    : fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
};

module.exports = fill;
