/**
 * Manages the internal config of nodemon, including system capability detection,
 * file watching strategies, and config merging.
 *
 * This is NOT the user's configuration.
 */

const debug = require('debug')('nodemon');
const load = require('./load');
const rules = require('../rules');
const utils = require('../utils');
const pinVersion = require('../version').pin;
const command = require('./command');
const { rulesToMonitor } = require('../monitor/match');
const bus = utils.bus;

/**
 * Resets internal nodemon state.
 */
function reset() {
  rules.reset();

  config.dirs = [];
  config.options = { ignore: [], watch: [], monitor: [] };
  config.lastStarted = 0;
  config.loaded = [];
}

/**
 * Core internal configuration object
 */
const config = {
  run: false,

  system: {
    cwd: process.cwd(),
  },

  required: false,
  dirs: [],
  timeout: 1000,
  options: {},
};

/**
 * Loads nodemon configuration from:
 * - User CLI options
 * - Local/global nodemon.json
 * - System defaults
 *
 * @param {Object} settings
 * @param {Function} ready
 */
config.load = function (settings, ready) {
  reset();

  const self = this;

  load(settings, self.options, self, function (options) {
    self.options = options;

    // Ensure watch array is never empty
    if (options.watch.length === 0) {
      options.watch.push('*.*');
    }

    // Backward compatibility for watch interval
    if (options.watch_interval) {
      options.watchInterval = options.watch_interval;
    }

    self.watchInterval = options.watchInterval || null;

    if (options.signal) {
      self.signal = options.signal;
    }

    // Build execution command
    const cmd = command(self.options);

    self.command = {
      raw: cmd,
      string: utils.stringify(cmd.executable, cmd.args),
    };

    // Apply automatic monitor rules
    options.monitor = rulesToMonitor(options.watch, options.ignore, self);

    const cwd = process.cwd();
    debug('config: dirs', self.dirs);

    if (self.dirs.length === 0) {
      self.dirs.unshift(cwd);
    }

    bus.emit('config:update', self);

    pinVersion()
      .then(() => {
        ready(self);
      })
      .catch((e) => {
        // Surface unexpected internal errors clearly
        console.error(e.stack);
        setTimeout(() => {
          throw e;
        }, 0);
      });
  });
};

config.reset = reset;

module.exports = config;
