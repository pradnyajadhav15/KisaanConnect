/*!
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

'use strict';

const isExtglob = require('is-extglob');

const chars = { '{': '}', '(': ')', '[': ']' };

/**
 * Strict glob check
 */
function strictCheck(str) {
  if (str[0] === '!') return true;

  let index = 0;
  let pipeIndex = -2;
  let closeSquareIndex = -2;
  let closeCurlyIndex = -2;
  let closeParenIndex = -2;
  let backSlashIndex = -2;

  while (index < str.length) {
    const char = str[index];
    const nextChar = str[index + 1];

    if (char === '*') return true;

    if (nextChar === '?' && /[\].+)]/.test(char)) return true;

    // Check brackets
    if (closeSquareIndex !== -1 && char === '[' && nextChar !== ']') {
      if (closeSquareIndex < index) closeSquareIndex = str.indexOf(']', index);
      if (closeSquareIndex > index) {
        if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) return true;
        backSlashIndex = str.indexOf('\\', index);
        if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) return true;
      }
    }

    // Check curly braces
    if (closeCurlyIndex !== -1 && char === '{' && nextChar !== '}') {
      closeCurlyIndex = str.indexOf('}', index);
      if (closeCurlyIndex > index) {
        backSlashIndex = str.indexOf('\\', index);
        if (backSlashIndex === -1 || backSlashIndex > closeCurlyIndex) return true;
      }
    }

    // Check parentheses with special characters
    if (
      closeParenIndex !== -1 &&
      char === '(' &&
      nextChar === '?' &&
      /[:!=]/.test(str[index + 2]) &&
      str[index + 3] !== ')'
    ) {
      closeParenIndex = str.indexOf(')', index);
      if (closeParenIndex > index) {
        backSlashIndex = str.indexOf('\\', index);
        if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) return true;
      }
    }

    // Check pipes inside parentheses
    if (pipeIndex !== -1 && char === '(' && nextChar !== '|') {
      if (pipeIndex < index) pipeIndex = str.indexOf('|', index);
      if (pipeIndex !== -1 && str[pipeIndex + 1] !== ')') {
        closeParenIndex = str.indexOf(')', pipeIndex);
        if (closeParenIndex > pipeIndex) {
          backSlashIndex = str.indexOf('\\', pipeIndex);
          if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) return true;
        }
      }
    }

    // Handle escaped characters
    if (char === '\\') {
      const open = str[index + 1];
      index += 2;
      const close = chars[open];
      if (close) {
        const n = str.indexOf(close, index);
        if (n !== -1) index = n + 1;
      }
      if (str[index] === '!') return true;
    } else {
      index++;
    }
  }

  return false;
}

/**
 * Relaxed glob check
 */
function relaxedCheck(str) {
  if (str[0] === '!') return true;

  let index = 0;
  while (index < str.length) {
    const char = str[index];

    if (/[*?{}()[\]]/.test(char)) return true;

    if (char === '\\') {
      const open = str[index + 1];
      index += 2;
      const close = chars[open];
      if (close) {
        const n = str.indexOf(close, index);
        if (n !== -1) index = n + 1;
      }
      if (str[index] === '!') return true;
    } else {
      index++;
    }
  }

  return false;
}

/**
 * Main export
 */
module.exports = function isGlob(str, options) {
  if (typeof str !== 'string' || str === '') return false;

  if (isExtglob(str)) return true;

  const check = options && options.strict === false ? relaxedCheck : strictCheck;
  return check(str);
};
