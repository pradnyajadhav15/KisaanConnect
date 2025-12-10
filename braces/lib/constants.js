'use strict';

/**
 * Character codes and constants used across the parser/lexer.
 * This file centralizes all frequently-used character references.
 */

module.exports = {
  // Limits
  MAX_LENGTH: 10000,

  // Numeric characters
  CHAR_0: '0',
  CHAR_9: '9',

  // Alphabetic ranges
  CHAR_UPPERCASE_A: 'A',
  CHAR_UPPERCASE_Z: 'Z',
  CHAR_LOWERCASE_A: 'a',
  CHAR_LOWERCASE_Z: 'z',

  // Grouping characters
  CHAR_LEFT_PARENTHESES: '(',
  CHAR_RIGHT_PARENTHESES: ')',

  // Repetition / wildcard
  CHAR_ASTERISK: '*',

  // Common non-alphabetic characters
  CHAR_AMPERSAND: '&',
  CHAR_AT: '@',
  CHAR_BACKSLASH: '\\',
  CHAR_BACKTICK: '`',
  CHAR_CARRIAGE_RETURN: '\r',
  CHAR_CIRCUMFLEX_ACCENT: '^',
  CHAR_COLON: ':',
  CHAR_COMMA: ',',
  CHAR_DOLLAR: '$',
  CHAR_DOT: '.',
  CHAR_DOUBLE_QUOTE: '"',
  CHAR_EQUAL: '=',
  CHAR_EXCLAMATION_MARK: '!',
  CHAR_FORM_FEED: '\f',
  CHAR_FORWARD_SLASH: '/',
  CHAR_HASH: '#',
  CHAR_HYPHEN_MINUS: '-',
  CHAR_LEFT_ANGLE_BRACKET: '<',
  CHAR_LEFT_CURLY_BRACE: '{',
  CHAR_LEFT_SQUARE_BRACKET: '[',
  CHAR_LINE_FEED: '\n',
  CHAR_NO_BREAK_SPACE: '\u00A0',
  CHAR_PERCENT: '%',
  CHAR_PLUS: '+',
  CHAR_QUESTION_MARK: '?',
  CHAR_RIGHT_ANGLE_BRACKET: '>',
  CHAR_RIGHT_CURLY_BRACE: '}',
  CHAR_RIGHT_SQUARE_BRACKET: ']',
  CHAR_SEMICOLON: ';',
  CHAR_SINGLE_QUOTE: "'",
  CHAR_SPACE: ' ',
  CHAR_TAB: '\t',
  CHAR_UNDERSCORE: '_',
  CHAR_VERTICAL_LINE: '|',
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: '\uFEFF'
};
