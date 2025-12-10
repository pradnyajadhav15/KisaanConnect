'use strict';

/**
 * Colour a string for terminal output.
 * Supports 'red', 'yellow', 'green'.
 *
 * @param {string} c - Colour name
 * @param {string} str - String to colour
 * @returns {string} Coloured string
 */
function colour(c, str) {
  // Use the requested colour, or default to black
  return (colour[c] || colour.black) + str + colour.black;
}

/**
 * Strip terminal colour codes from a string
 * @param {string} str
 * @returns {string} Plain string
 */
function strip(str) {
  re.lastIndex = 0; // reset regex
  return str.replace(re, '');
}

// Terminal colour codes
colour.red = '\x1B[31m';
colour.yellow = '\x1B[33m';
colour.green = '\x1B[32m';
colour.black = '\x1B[39m';

// Regex to match all colour codes
const reStr = Object.values(colour).join('|').replace(/\[/g, '\\[');
const re = new RegExp(`(${reStr})`, 'g');

// Add strip utility
colour.strip = strip;

module.exports = colour;

