/**
 * Loads nodemon configuration, merging global, local, and CLI settings.
 * Handles script discovery, exec options, and rule normalization.
 */

const debug = require('debug')('nodemon');
const fs = require('fs');
const path = require('path');
const utils = require('../utils');
const rules = require('../rules');
const exec = require('./exec');
const defaults = require('./defaults');

module.exports = load;
module.exports.mutateExecOptions = mutateExecOptions;

const existsSync = fs.existsSync || path.existsSync;

/**
 * Try to find the app script if not explicitly provided
 */
function findAppScript() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = existsSync(pkgPath) && require(pkgPath);

  if ((!pkg || !pkg.main) && existsSync('./index.js')) {
    return 'index.js';
  }
}

/**
 * Load nodemon configuration
 * @param {Object} settings CLI/user settings
 * @param {Object} options global options
 * @param {Object} config config object to update
 * @param {Function} callback called with final merged options
 */
function load(settings, options, config, callback) {
  config.loaded = [];

  // Load global nodemon.json
  loadFile(options, config, utils.home, (options) => {
    // Load local nodemon.json (or specified file)
    if (settings.configFile) {
      options.configFile = path.resolve(settings.configFile);
    }

    loadFile(options, config, process.cwd(), (options) => {
      // Merge CLI/user settings (priority)
      options = utils.merge(settings, options);

      // Legacy support: ensure ignore is an array
      if (!Array.isArray(options.ignore)) {
        options.ignore = [options.ignore];
      }

      if (!options.ignoreRoot) {
        options.ignoreRoot = defaults.ignoreRoot;
      }

      // Merge default ignores
      options.ignore = (options.ignoreRoot || []).concat(options.ignore);

      // Fill missing defaults
      options = utils.merge(options, defaults);

      // Discover script if not provided
      if (!options.script && !options.exec) {
        const found = findAppScript();
        if (found) {
          options.args = options.args || [];
          const n = options.scriptPosition === null ? options.args.length : options.scriptPosition;
          options.execArgs = (options.execArgs || []).concat(options.args.splice(0, n));
          options.scriptPosition = null;
          options.script = found;
        }
      }

      // Determine final exec options
      mutateExecOptions(options);

      // Apply utility flags
      if (options.quiet) utils.quiet();
      if (options.verbose) utils.debug = true;

      // Normalize rules (watch & ignore)
      normaliseRules(options, callback);
    });
  });
}

/**
 * Normalize watch and ignore arrays into rules
 */
function normaliseRules(options, ready) {
  rules.watch.add(options.watch);
  rules.ignore.add(options.ignore);

  options.watch = options.watch === false ? false : rules.rules.watch;
  options.ignore = rules.rules.ignore;

  ready(options);
}

/**
 * Load a configuration file (nodemon.json or package.json)
 */
function loadFile(options, config, dir, ready = () => {}) {
  const callback = (settings) => ready(utils.merge(settings, options));
  if (!dir) return callback({});

  const filename = options.configFile || path.join(dir, 'nodemon.json');
  if (config.loaded.includes(filename)) return callback({});

  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' && !options.configFile && dir !== utils.home) {
        return loadPackageJSON(config, callback);
      }
      return callback({});
    }

    let settings = {};
    try {
      settings = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
      if (!filename.endsWith('package.json') || settings.nodemonConfig) {
        config.loaded.push(filename);
      }
    } catch (e) {
      utils.log.fail(`Failed to parse config ${filename}`);
      console.error(e);
      process.exit(1);
    }

    callback(settings);
  });
}

/**
 * Load configuration from package.json
 */
function loadPackageJSON(config, ready = () => {}) {
  const dir = process.cwd();
  const filename = path.join(dir, 'package.json');
  return loadFile({ configFile: filename }, config, dir, (settings) => {
    ready(settings.nodemonConfig || {});
  });
}

/**
 * Determine final exec options based on script, args, nodeArgs, etc.
 */
function mutateExecOptions(options) {
  options.execOptions = exec(
    {
      script: options.script,
      exec: options.exec,
      args: options.args,
      scriptPosition: options.scriptPosition,
      nodeArgs: options.nodeArgs,
      execArgs: options.execArgs,
      ext: options.ext,
      env: options.env,
    },
    options.execMap
  );

  // Remove top-level keys that are now inside execOptions
  delete options.scriptPosition;
  delete options.script;
  delete options.args;
  delete options.ext;

  return options;
}
