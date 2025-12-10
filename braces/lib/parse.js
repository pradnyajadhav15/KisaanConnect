'use strict';

const stringify = require('./stringify');

/**
 * Constants
 */
const {
  MAX_LENGTH,
  CHAR_BACKSLASH,
  CHAR_BACKTICK,
  CHAR_COMMA,
  CHAR_DOT,
  CHAR_LEFT_PARENTHESES,
  CHAR_RIGHT_PARENTHESES,
  CHAR_LEFT_CURLY_BRACE,
  CHAR_RIGHT_CURLY_BRACE,
  CHAR_LEFT_SQUARE_BRACKET,
  CHAR_RIGHT_SQUARE_BRACKET,
  CHAR_DOUBLE_QUOTE,
  CHAR_SINGLE_QUOTE,
  CHAR_NO_BREAK_SPACE,
  CHAR_ZERO_WIDTH_NOBREAK_SPACE
} = require('./constants');

/**
 * Parse
 * Converts a brace-pattern string into an Abstract Syntax Tree (AST).
 */
const parse = (input, options = {}) => {
  if (typeof input !== 'string') {
    throw new TypeError('Expected a string');
  }

  const opts = options || {};
  const maxAllowed = typeof opts.maxLength === 'number'
    ? Math.min(MAX_LENGTH, opts.maxLength)
    : MAX_LENGTH;

  if (input.length > maxAllowed) {
    throw new SyntaxError(
      `Input length (${input.length}) exceeds max characters (${maxAllowed})`
    );
  }

  // Root AST node
  const ast = { type: 'root', input, nodes: [] };

  // Stack is used for nested constructs: braces, parentheses, quotes, etc.
  const stack = [ast];

  let block = ast;
  let prev = ast;

  let brackets = 0;     // Tracks nested [ ... ] sections
  let depth = 0;        // Tracks brace nesting depth { ... }
  let index = 0;

  const length = input.length;
  let value;

  /** Utility: consume next character */
  const advance = () => input[index++];

  /** Utility: attach a node to current block */
  const push = node => {
    // Convert `dot` to `text` if next token starts text sequence
    if (node.type === 'text' && prev.type === 'dot') {
      prev.type = 'text';
    }

    // Merge consecutive text nodes
    if (prev && prev.type === 'text' && node.type === 'text') {
      prev.value += node.value;
      return;
    }

    block.nodes.push(node);
    node.parent = block;
    node.prev = prev;
    prev = node;
    return node;
  };

  // Beginning-of-string marker
  push({ type: 'bos' });

  /**
   * Main parse loop
   */
  while (index < length) {
    block = stack[stack.length - 1];
    value = advance();

    /**
     * Skip whitespace-only Unicode characters that are invisible
     */
    if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE ||
        value === CHAR_NO_BREAK_SPACE) {
      continue;
    }

    /**
     * Escape sequences: `\x` → treat literally
     */
    if (value === CHAR_BACKSLASH) {
      const nextChar = advance();
      push({
        type: 'text',
        value: (options.keepEscaping ? value : '') + nextChar
      });
      continue;
    }

    /**
     * Literal ']' — always escaped
     */
    if (value === CHAR_RIGHT_SQUARE_BRACKET) {
      push({ type: 'text', value: '\\' + value });
      continue;
    }

    /**
     * Character class parsing: [ ... ]
     */
    if (value === CHAR_LEFT_SQUARE_BRACKET) {
      brackets++;
      let next, collected = value;

      while (index < length && (next = advance())) {
        collected += next;

        if (next === CHAR_LEFT_SQUARE_BRACKET) {
          brackets++;
          continue;
        }

        if (next === CHAR_BACKSLASH) {
          collected += advance();
          continue;
        }

        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
          brackets--;
          if (brackets === 0) break;
        }
      }

      push({ type: 'text', value: collected });
      continue;
    }

    /**
     * Parentheses parsing: ( ... )
     */
    if (value === CHAR_LEFT_PARENTHESES) {
      block = push({ type: 'paren', nodes: [] });
      stack.push(block);
      push({ type: 'text', value });
      continue;
    }

    if (value === CHAR_RIGHT_PARENTHESES) {
      if (block.type !== 'paren') {
        push({ type: 'text', value });
        continue;
      }

      stack.pop();
      push({ type: 'text', value });
      block = stack[stack.length - 1];
      continue;
    }

    /**
     * Quote parsing: " ... " , ' ... ' , ` ... `
     */
    if (value === CHAR_DOUBLE_QUOTE ||
        value === CHAR_SINGLE_QUOTE ||
        value === CHAR_BACKTICK) {

      const opener = value;
      let temp = options.keepQuotes ? value : '';
      let next;

      while (index < length && (next = advance())) {
        if (next === CHAR_BACKSLASH) {
          temp += next + advance();
          continue;
        }
        if (next === opener) {
          if (options.keepQuotes) temp += next;
          break;
        }
        temp += next;
      }

      push({ type: 'text', value: temp });
      continue;
    }

    /**
     * Opening brace: {
     */
    if (value === CHAR_LEFT_CURLY_BRACE) {
      depth++;

      const dollarPrefix =
        (prev.value && prev.value.slice(-1) === '$') || block.dollar === true;

      const braceNode = {
        type: 'brace',
        open: true,
        close: false,
        dollar: dollarPrefix,
        depth,
        commas: 0,
        ranges: 0,
        nodes: []
      };

      block = push(braceNode);
      stack.push(block);
      push({ type: 'open', value });
      continue;
    }

    /**
     * Closing brace: }
     */
    if (value === CHAR_RIGHT_CURLY_BRACE) {
      if (block.type !== 'brace') {
        push({ type: 'text', value });
        continue;
      }

      stack.pop();
      block.close = true;

      push({ type: 'close', value });
      depth--;

      block = stack[stack.length - 1];
      continue;
    }

    /**
     * Comma inside braces: a{b,c}
     */
    if (value === CHAR_COMMA && depth > 0) {

      // Reset range detection if comma interrupts range
      if (block.ranges > 0) {
        block.ranges = 0;
        const open = block.nodes.shift();
        block.nodes = [open, { type: 'text', value: stringify(block) }];
      }

      push({ type: 'comma', value });
      block.commas++;
      continue;
    }

    /**
     * Range detection with dots: {1..5}, {a..z}
     */
    if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
      const siblings = block.nodes;

      if (depth === 0 || siblings.length === 0) {
        push({ type: 'text', value });
        continue;
      }

      if (prev.type === 'dot') {
        prev.value += value;
        prev.type = 'range';
        block.range = [];

        if (block.nodes.length !== 3 && block.nodes.length !== 5) {
          block.invalid = true;
          block.ranges = 0;
          prev.type = 'text';
          continue;
        }

        block.ranges++;
        block.args = [];
        continue;
      }

      if (prev.type === 'range') {
        siblings.pop();
        const last = siblings[siblings.length - 1];
        last.value += prev.value + value;
        prev = last;
        block.ranges--;
        continue;
      }

      push({ type: 'dot', value });
      continue;
    }

    /**
     * Default: Plain text
     */
    push({ type: 'text', value });
  }

  /**
   * Final cleanup:
   * Unmatched braces or parentheses are marked invalid and converted into text nodes.
   */
  do {
    block = stack.pop();

    if (block.type !== 'root') {
      block.nodes.forEach(node => {
        if (!node.nodes) {
          if (node.type === 'open') node.isOpen = true;
          if (node.type === 'close') node.isClose = true;

          node.type = 'text';
          node.invalid = true;
        }
      });

      const parent = stack[stack.length - 1];
      const pos = parent.nodes.indexOf(block);
      parent.nodes.splice(pos, 1, ...block.nodes);
    }
  } while (stack.length > 0);

  push({ type: 'eos' });
  return ast;
};

module.exports = parse;
