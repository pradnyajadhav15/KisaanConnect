'use strict';

/* -------------------------------------------
   1️⃣ MODULE EXPORT SETUP
------------------------------------------- */

Object.defineProperty(exports, "__esModule", { value: true });

const picomatch = require('picomatch');        // Used for glob pattern matching
const normalizePath = require('normalize-path'); // Fixes file path format


/* -------------------------------------------
   2️⃣ TYPE DEFINITIONS (FOR UNDERSTANDING)
------------------------------------------- */

/**
 * AnymatchFn      → A function that receives a string and returns true/false
 * AnymatchPattern→ string | RegExp | function
 * AnymatchMatcher→ single pattern OR array of patterns
 */


/* -------------------------------------------
   3️⃣ CONSTANT VALUES
------------------------------------------- */

const BANG = '!';  // Used to detect negated patterns like "!node_modules"
const DEFAULT_OPTIONS = { returnIndex: false };


/* -------------------------------------------
   4️⃣ HELPER FUNCTION: arrify()
   Turns single value into array
------------------------------------------- */

const arrify = (item) => {
  return Array.isArray(item) ? item : [item];
};


/* -------------------------------------------
   5️⃣ createPattern()
   Converts matcher into a usable function
------------------------------------------- */

const createPattern = (matcher, options) => {

  // ✅ If matcher itself is a function → return it
  if (typeof matcher === 'function') {
    return matcher;
  }

  // ✅ If matcher is a string → convert it into a glob matcher
  if (typeof matcher === 'string') {
    const glob = picomatch(matcher, options);

    return (string) => {
      return matcher === string || glob(string);
    };
  }

  // ✅ If matcher is a RegExp → test it
  if (matcher instanceof RegExp) {
    return (string) => matcher.test(string);
  }

  // ❌ If nothing matches → always return false
  return () => false;
};


/* -------------------------------------------
   6️⃣ matchPatterns()
   Matches input against patterns
------------------------------------------- */

const matchPatterns = (patterns, negPatterns, args, returnIndex) => {

  const isList = Array.isArray(args); // true if input is array
  const _path = isList ? args[0] : args;

  // ❌ If input is not string → error
  if (!isList && typeof _path !== 'string') {
    throw new TypeError(
      'anymatch: second argument must be a string: got ' +
      Object.prototype.toString.call(_path)
    );
  }

  // ✅ Normalize file path
  const path = normalizePath(_path, false);


  /* ----- STEP 1: CHECK NEGATIVE PATTERNS (!pattern) ----- */

  for (let index = 0; index < negPatterns.length; index++) {
    const nglob = negPatterns[index];

    if (nglob(path)) {
      return returnIndex ? -1 : false;
    }
  }


  /* ----- STEP 2: CHECK POSITIVE PATTERNS ----- */

  const applied = isList && [path].concat(args.slice(1));

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];

    const isMatch = isList
      ? pattern(...applied)
      : pattern(path);

    if (isMatch) {
      return returnIndex ? index : true;
    }
  }

  // ❌ No match found
  return returnIndex ? -1 : false;
};


/* -------------------------------------------
   7️⃣ MAIN anymatch() FUNCTION
------------------------------------------- */

const anymatch = (matchers, testString, options = DEFAULT_OPTIONS) => {

  // ❌ If no matcher provided
  if (matchers == null) {
    throw new TypeError('anymatch: specify first argument');
  }

  // ✅ If options is boolean → treat as returnIndex
  const opts = typeof options === 'boolean'
    ? { returnIndex: options }
    : options;

  const returnIndex = opts.returnIndex || false;


  /* ----- PREPARE MATCHERS ----- */

  const mtchers = arrify(matchers);

  // ✅ Extract negated patterns: "!test"
  const negatedGlobs = mtchers
    .filter(item => typeof item === 'string' && item.charAt(0) === BANG)
    .map(item => item.slice(1))
    .map(item => picomatch(item, opts));

  // ✅ Extract positive patterns
  const patterns = mtchers
    .filter(item => typeof item !== 'string' || item.charAt(0) !== BANG)
    .map(matcher => createPattern(matcher, opts));


  /* ----- IF NO STRING PROVIDED → RETURN A TEST FUNCTION ----- */

  if (testString == null) {
    return (testString, ri = false) => {
      const returnIndex = typeof ri === 'boolean' ? ri : false;

      return matchPatterns(
        patterns,
        negatedGlobs,
        testString,
        returnIndex
      );
    };
  }


  /* ----- ELSE → DIRECTLY MATCH ----- */

  return matchPatterns(
    patterns,
    negatedGlobs,
    testString,
    returnIndex
  );
};


/* -------------------------------------------
   8️⃣ EXPORT THE FUNCTION
------------------------------------------- */

anymatch.default = anymatch;
module.exports = anymatch;
