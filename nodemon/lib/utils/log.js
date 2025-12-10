'use strict';

const colour = require('./colour');
const bus = require('./bus');

let required = false;   // whether logging is internal only (no console output)
let useColours = true;  // enable coloured output in console

// Mapping of log types to colours
const coding = {
  log: 'black',
  info: 'yellow',
  status: 'green',
  detail: 'yellow',
  fail: 'red',
  error: 'red',
};

/**
 * Core logging function
 * @param {string} type - log type (info, error, status, etc.)
 * @param {string} text - message to log
 */
function log(type, text) {
  let msg = `[nodemon] ${text || ''}`;

  // Apply colours if enabled
  if (useColours) {
    msg = colour(coding[type], msg);
  }

  // Emit the log event through the bus asynchronously
  process.nextTick(() => {
    bus.emit('log', { type, message: text, colour: msg });
  });

  // Echo to console if logging is not internal-only
  if (!required) {
    if (type === 'error') {
      console.error(msg);
    } else {
      console.log(msg || '');
    }
  }
}

/**
 * Logger constructor
 * @param {boolean} r - whether logging is required/internal
 */
function Logger(r) {
  if (!(this instanceof Logger)) return new Logger(r);
  this.required(r);
}

// Add logging methods for each type dynamically
Object.keys(coding).forEach((type) => {
  Logger.prototype[type] = log.bind(null, type);
});

// 'detail' logs are only shown when debug is enabled
Logger.prototype.detail = function (msg) {
  if (this.debug) log('detail', msg);
};

/**
 * Set whether this logger is required/internal
 */
Logger.prototype.required = function (val) {
  required = val;
};

// Default debug state
Logger.prototype.debug = false;

/**
 * Internal logging method for direct output without type mapping
 */
Logger.prototype._log = function (type, msg) {
  if (required) {
    bus.emit('log', { type, message: msg || '', colour: msg || '' });
  } else if (type === 'error') {
    console.error(msg);
  } else {
    console.log(msg || '');
  }
};

// Proxy property to control coloured output
Object.defineProperty(Logger.prototype, 'useColours', {
  get() {
    return useColours;
  },
  set(val) {
    useColours = val;
  },
});

module.exports = Logger;
