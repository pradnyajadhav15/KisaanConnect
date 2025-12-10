/**
 * Time conversion constants (in milliseconds)
 */

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR   = MINUTE * 60;
const DAY    = HOUR * 24;
const WEEK   = DAY * 7;
const YEAR   = DAY * 365.25;

/**
 * Main Exported Function
 * - Parses time strings → milliseconds
 * - Formats milliseconds → readable time
 *
 * @param {string|number} value
 * @param {object} options
 * @returns {string|number}
 */

module.exports = function (value, options = {}) {
  const type = typeof value;

  // ✅ If input is a time string → parse it
  if (type === "string" && value.length > 0) {
    return parseTime(value);
  }

  // ✅ If input is a number → format it
  if (type === "number" && isFinite(value)) {
    return options.long ? formatLong(value) : formatShort(value);
  }

  // ❌ Invalid input
  throw new Error(
    "val is not a non-empty string or a valid number. val=" +
      JSON.stringify(value)
  );
};

/* ==========================================================
   PARSE STRING → MILLISECONDS
========================================================== */

function parseTime(input) {
  input = String(input);

  // Prevent very large malicious strings
  if (input.length > 100) return;

  const match = /^(-?(?:\d+)?\.?\d+)\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    input
  );

  if (!match) return;

  const number = parseFloat(match[1]);
  const unit = (match[2] || "ms").toLowerCase();

  switch (unit) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return number * YEAR;

    case "weeks":
    case "week":
    case "w":
      return number * WEEK;

    case "days":
    case "day":
    case "d":
      return number * DAY;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return number * HOUR;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return number * MINUTE;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return number * SECOND;

    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return number;

    default:
      return undefined;
  }
}

/* ==========================================================
   SHORT FORMAT → 5000 → "5s"
========================================================== */

function formatShort(ms) {
  const abs = Math.abs(ms);

  if (abs >= DAY) return Math.round(ms / DAY) + "d";
  if (abs >= HOUR) return Math.round(ms / HOUR) + "h";
  if (abs >= MINUTE) return Math.round(ms / MINUTE) + "m";
  if (abs >= SECOND) return Math.round(ms / SECOND) + "s";

  return ms + "ms";
}

/* ==========================================================
   LONG FORMAT → 5000 → "5 seconds"
========================================================== */

function formatLong(ms) {
  const abs = Math.abs(ms);

  if (abs >= DAY) return plural(ms, abs, DAY, "day");
  if (abs >= HOUR) return plural(ms, abs, HOUR, "hour");
  if (abs >= MINUTE) return plural(ms, abs, MINUTE, "minute");
  if (abs >= SECOND) return plural(ms, abs, SECOND, "second");

  return ms + " ms";
}

/* ==========================================================
   PLURAL HANDLER → 1 day vs 2 days
========================================================== */

function plural(ms, abs, unit, label) {
  const isPlural = abs >= unit * 1.5;
  return Math.round(ms / unit) + " " + label + (isPlural ? "s" : "");
}
