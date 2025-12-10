'use strict';

const concatMap = require('concat-map');
const balanced = require('balanced-match');

module.exports = expandTop;

// Unique placeholders for escaped characters
const escSlash = '\0SLASH' + Math.random() + '\0';
const escOpen  = '\0OPEN'  + Math.random() + '\0';
const escClose = '\0CLOSE' + Math.random() + '\0';
const escComma = '\0COMMA' + Math.random() + '\0';
const escPeriod= '\0PERIOD'+ Math.random() + '\0';

/**
 * Convert numeric string to integer or char code.
 */
function numeric(str) {
  return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
}

/**
 * Escape special brace characters for processing.
 */
function escapeBraces(str) {
  return str.split('\\\\').join(escSlash)
            .split('\\{').join(escOpen)
            .split('\\}').join(escClose)
            .split('\\,').join(escComma)
            .split('\\.').join(escPeriod);
}

/**
 * Restore escaped characters to original form.
 */
function unescapeBraces(str) {
  return str.split(escSlash).join('\\')
            .split(escOpen).join('{')
            .split(escClose).join('}')
            .split(escComma).join(',')
            .split(escPeriod).join('.');
}

/**
 * Parse comma-separated parts while handling nested braces.
 */
function parseCommaParts(str) {
  if (!str) return [''];

  const parts = [];
  const m = balanced('{', '}', str);

  if (!m) return str.split(',');

  const pre = m.pre;
  const body = m.body;
  const post = m.post;
  const p = pre.split(',');

  p[p.length - 1] += `{${body}}`;
  const postParts = parseCommaParts(post);

  if (post.length) {
    p[p.length - 1] += postParts.shift();
    p.push(...postParts);
  }

  parts.push(...p);
  return parts;
}

/**
 * Top-level brace expansion entry point.
 */
function expandTop(str) {
  if (!str) return [];

  // Handle Bash quirk with leading '{}'
  if (str.startsWith('{}')) {
    str = '\\{\\}' + str.slice(2);
  }

  return expand(escapeBraces(str), true).map(unescapeBraces);
}

/**
 * Wrap string in braces.
 */
function embrace(str) {
  return `{${str}}`;
}

/**
 * Detect if a number is padded (e.g., 01, -02)
 */
function isPadded(el) {
  return /^-?0\d/.test(el);
}

/**
 * Comparison helpers
 */
function lte(i, y) { return i <= y; }
function gte(i, y) { return i >= y; }

/**
 * Core recursive expansion logic
 */
function expand(str, isTop) {
  const expansions = [];
  const m = balanced('{', '}', str);

  if (!m || /\$$/.test(m.pre)) return [str];

  const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
  const isAlphaSequence   = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
  const isSequence        = isNumericSequence || isAlphaSequence;
  const isOptions         = m.body.includes(',');

  // Handle trivial or nested comma sets
  if (!isSequence && !isOptions) {
    if (m.post.match(/,.*\}/)) {
      str = `${m.pre}{${m.body}${escClose}${m.post}`;
      return expand(str);
    }
    return [str];
  }

  // Generate parts to expand
  let n = isSequence
    ? m.body.split(/\.\./)
    : parseCommaParts(m.body);

  if (!isSequence && n.length === 1) {
    n = expand(n[0], false).map(embrace);
    if (n.length === 1) {
      const post = m.post.length ? expand(m.post, false) : [''];
      return post.map(p => m.pre + n[0] + p);
    }
  }

  const pre  = m.pre;
  const post = m.post.length ? expand(m.post, false) : [''];
  let N;

  // Numeric or alpha sequences
  if (isSequence) {
    let x = numeric(n[0]);
    let y = numeric(n[1]);
    const width = Math.max(n[0].length, n[1].length);
    let incr = n.length === 3 ? Math.abs(numeric(n[2])) : 1;
    let test = lte;
    const reverse = y < x;

    if (reverse) { incr *= -1; test = gte; }

    const pad = n.some(isPadded);
    N = [];

    for (let i = x; test(i, y); i += incr) {
      let c = isAlphaSequence ? String.fromCharCode(i) : String(i);
      if (!isAlphaSequence && pad) {
        const need = width - c.length;
        if (need > 0) {
          const z = '0'.repeat(need);
          c = i < 0 ? '-' + z + c.slice(1) : z + c;
        }
      }
      N.push(c);
    }
  } else {
    // Expand options recursively
    N = concatMap(n, el => expand(el, false));
  }

  // Combine pre, expanded parts, and post
  for (const nPart of N) {
    for (const pPart of post) {
      const expansion = pre + nPart + pPart;
      if (!isTop || isSequence || expansion) expansions.push(expansion);
    }
  }

  return expansions;
}
