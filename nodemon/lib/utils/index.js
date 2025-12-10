'use strict';

const path = require('path');
const semver = require('semver');
const os = require('os');

const noop = () => {};

const versionParts = process.versions.node.split('.') || [0, 0, 0];

const utils = (module.exports = {
  // Node version and semver utilities
  semver: semver,
  satisfies: (range) => semver.satisfies(process.versions.node, range),
  version: {
    major: parseInt(versionParts[0] || 0, 10),
    minor: parseInt(versionParts[1] || 0, 10),
    patch: parseInt(versionParts[2] || 0, 10),
  },

  // General utilities
  clone: require('./clone'),
  merge: require('./merge'),
  bus: require('./bus'),

  // Platform detection
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isIBMi: os.type() === 'OS400',

  // Detect if this module is required or executed directly
  isRequired: (() => {
    let parent = module.parent;
    while (parent) {
      if (!parent.filename) return true;
      if (parent.filename.includes(`bin${path.sep}nodemon.js`)) return false;
      parent = parent.parent;
    }
    return true;
  })(),

  // Home directory
  home: process.env.HOME || process.env.HOMEPATH,

  // Logging control
  quiet() {
    if (!this.debug) {
      for (const method in this.log) {
        if (typeof this.log[method] === 'function') this.log[method] = noop;
      }
    }
  },

  reset() {
    if (!this.debug) {
      for (const method in this.log) {
        if (typeof this.log[method] === 'function') delete this.log[method];
      }
    }
    this.debug = false;
  },

  // Convert a regexp string back to human-readable text
  regexpToText(str) {
    return str
      .replace(/\.\*\\./g, '*.')
      .replace(/\\{2}/g, '^^')
      .replace(/\\/g, '')
      .replace(/\^\^/g, '\\');
  },

  // Serialize executable + args to a command string
  stringify(exec, args = []) {
    return [exec]
      .concat(
        args.map((arg) =>
          arg.length > 0 && !arg.includes(' ') ? arg : JSON.stringify(arg)
        )
      )
      .join(' ')
      .trim();
  },
});

// Logging utility
utils.log = require('./log')(utils.isRequired);

// Proxy debug and colour properties to log module
Object.defineProperty(utils, 'debug', {
  get() {
    return this.log.debug;
  },
  set(value) {
    this.log.debug = value;
  },
});

Object.defineProperty(utils, 'colours', {
  get() {
    return this.log.useColours;
  },
  set(value) {
    this.log.useColours = value;
  },
});
