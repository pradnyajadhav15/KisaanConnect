const path = require("path");
const braceExpand = require("brace-expansion");

/* ======================================
   EXPORTS
====================================== */

module.exports = minimatch;
minimatch.Minimatch = Minimatch;

/* ======================================
   CONSTANTS
====================================== */

const GLOBSTAR = {}; // represents **
minimatch.GLOBSTAR = GLOBSTAR;

/* ======================================
   MAIN FUNCTION
====================================== */

function minimatch(filePath, pattern, options = {}) {
  const mm = new Minimatch(pattern, options);
  return mm.match(filePath);
}

/* ======================================
   MINIMATCH CLASS
====================================== */

function Minimatch(pattern, options = {}) {
  if (!(this instanceof Minimatch)) return new Minimatch(pattern, options);

  this.pattern = normalizePattern(pattern, options);
  this.options = options;
  this.set = [];
  this.negate = false;
  this.make();
}

/* ======================================
   BUILD PROCESS
====================================== */

Minimatch.prototype.make = function () {
  if (!this.pattern) return;

  // 1️⃣ Handle negation (!pattern)
  this.parseNegate();

  // 2️⃣ Expand braces {a,b}
  const expanded = this.braceExpand();

  // 3️⃣ Split into path segments
  this.set = expanded.map(p =>
    p.split("/").map(this.parsePart.bind(this))
  );
};

/* ======================================
   NEGATION HANDLING
====================================== */

Minimatch.prototype.parseNegate = function () {
  let negate = false;

  while (this.pattern.startsWith("!")) {
    negate = !negate;
    this.pattern = this.pattern.slice(1);
  }

  this.negate = negate;
};

/* ======================================
   BRACE EXPANSION
====================================== */

Minimatch.prototype.braceExpand = function () {
  return this.options.nobrace
    ? [this.pattern]
    : braceExpand(this.pattern);
};

/* ======================================
   PARSE EACH PATTERN PART
====================================== */

Minimatch.prototype.parsePart = function (part) {
  // Handle globstar **
  if (part === "**") return GLOBSTAR;

  // Convert glob pattern to regex
  const escaped = part
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp("^" + escaped + "$", this.options.nocase ? "i" : "");
};

/* ======================================
   MATCH FUNCTION
====================================== */

Minimatch.prototype.match = function (filePath) {
  filePath = normalizePath(filePath);
  const parts = filePath.split("/");

  for (const patternParts of this.set) {
    if (this.matchParts(parts, patternParts)) {
      return !this.negate;
    }
  }

  return this.negate;
};

/* ======================================
   MATCH PATH PARTS
====================================== */

Minimatch.prototype.matchParts = function (fileParts, patternParts) {
  let fi = 0;
  let pi = 0;

  while (fi < fileParts.length && pi < patternParts.length) {
    const p = patternParts[pi];
    const f = fileParts[fi];

    // ✅ Handle **
    if (p === GLOBSTAR) {
      if (pi === patternParts.length - 1) return true;

      while (fi < fileParts.length) {
        if (this.matchParts(
          fileParts.slice(fi),
          patternParts.slice(pi + 1)
        )) {
          return true;
        }
        fi++;
      }
      return false;
    }

    // ✅ Regex match
    if (!p.test(f)) return false;

    fi++;
    pi++;
  }

  return fi === fileParts.length && pi === patternParts.length;
};

/* ======================================
   HELPERS
====================================== */

function normalizePath(p) {
  return p.split(path.sep).join("/");
}

function normalizePattern(pattern, options) {
  return options.allowWindowsEscape
    ? pattern
    : pattern.split(path.sep).join("/");
}
