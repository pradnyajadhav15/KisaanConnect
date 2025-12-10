'use strict';

const debug = require('debug')('nodemon');
const path = require('path');
const util = require('util');

const monitor = require('./monitor');
const cli = require('./cli');
const version = require('./version');
const utils = require('./utils');
const bus = utils.bus;
const help = require('./help');
const config = require('./config');
const spawn = require('./spawn');
const defaults = require('./config/defaults');

let eventHandlers = {};
config.required = utils.isRequired;

/**
 * Main nodemon function
 * @param {string|object} settings - CLI string or options object
 * @returns {object} nodemon instance
 */
function nodemon(settings) {
  bus.emit('boot');
  nodemon.reset();

  let options;

  // Parse CLI string or use options object directly
  if (typeof settings === 'string') {
    settings = settings.trim();
    if (!settings.startsWith('node')) {
      if (!settings.startsWith('nodemon')) {
        settings = 'nodemon ' + settings;
      }
      settings = 'node ' + settings;
    }
    options = cli.parse(settings);
  } else {
    options = settings;
  }

  // Enable debug early if verbose
  if (options.verbose) utils.debug = true;

  // Handle help command
  if (options.help) {
    if (process.stdout.isTTY) process.stdout._handle.setBlocking(true);
    console.log(help(options.help));
    if (!config.required) process.exit(0);
  }

  // Handle version command
  if (options.version) {
    version().then(v => {
      console.log(v);
      if (!config.required) process.exit(0);
    });
    return;
  }

  // Handle custom working directory
  if (options.cwd && process.cwd() !== path.resolve(config.system.cwd, options.cwd)) {
    process.chdir(options.cwd);
  }

  // Load configuration
  config.load(options, function (config) {
    if (!config.options.dump && !config.options.execOptions.script &&
        config.options.execOptions.exec === 'node') {
      if (!config.required) {
        console.log(help('usage'));
        process.exit();
      }
      return;
    }

    // Set logging colors
    utils.colours = config.options.colours;

    // Show current nodemon version
    utils.log.info(version.pinned);

    const cwd = process.cwd();

    if (config.options.cwd) utils.log.detail('process root: ' + cwd);

    config.loaded.map(file => file.replace(cwd, '.'))
                 .forEach(file => utils.log.detail('reading config ' + file));

    setupStdin(options, config);

    if (config.options.restartable) {
      utils.log.info(`to restart at any time, enter \`${config.options.restartable}\``);
    }

    setupRestartSignals(config);

    logWatchingPaths(config);

    if (config.options.dump) {
      dumpConfig(config);
      if (!config.required) process.exit();
      return;
    }

    config.run = true;

    if (config.options.stdout === false) {
      nodemon.on('start', () => {
        nodemon.stdout = bus.stdout;
        nodemon.stderr = bus.stderr;
        bus.emit('readable');
      });
    }

    bindCustomEvents(config);

    monitor.run(config.options);
  });

  return nodemon;
}

/**
 * Restart the nodemon process
 */
nodemon.restart = function () {
  utils.log.status('restarting child process');
  bus.emit('restart');
  return nodemon;
};

/**
 * Event listener management
 */
nodemon.addListener = nodemon.on = function (event, handler) {
  eventHandlers[event] ??= [];
  eventHandlers[event].push(handler);
  bus.on(event, handler);
  return nodemon;
};

nodemon.once = function (event, handler) {
  eventHandlers[event] ??= [];
  eventHandlers[event].push(handler);
  bus.once(event, function () {
    debug('bus.once(%s)', event);
    eventHandlers[event].splice(eventHandlers[event].indexOf(handler), 1);
    handler.apply(this, arguments);
  });
  return nodemon;
};

nodemon.emit = function () {
  bus.emit.apply(bus, arguments);
  return nodemon;
};

nodemon.removeAllListeners = function (event) {
  Object.keys(eventHandlers)
    .filter(e => !event || e === event)
    .forEach(e => {
      eventHandlers[e].forEach(handler => {
        bus.removeListener(e, handler);
        eventHandlers[e].splice(eventHandlers[e].indexOf(handler), 1);
      });
    });
  return nodemon;
};

nodemon.reset = function (done) {
  bus.emit('reset', done);
};

// Reset logic when bus emits 'reset'
bus.on('reset', function (done) {
  debug('reset');
  nodemon.removeAllListeners();
  monitor.run.kill(true, () => {
    utils.reset();
    config.reset();
    config.run = false;
    done?.();
  });
});

// Expose the full config
nodemon.config = config;
module.exports = nodemon;

/** Helper functions **/

function setupStdin(options, config) {
  if (!options.stdin) return;

  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let buffer = '';
  let ctrlC = false;

  process.stdin.on('data', data => {
    const str = data.toString().trim().toLowerCase();
    const chr = data.charCodeAt(0);

    // Restart if matching restartable key
    if (config.options.restartable && str === config.options.restartable) {
      bus.emit('restart');
    } 
    // Handle control sequences
    else if (chr === 12) console.clear(); // ctrl+l
    else if (chr === 3) { // ctrl+c
      if (ctrlC) process.exit(0);
      ctrlC = true;
    } 
    else if (buffer === '.exit' || chr === 4) { // ctrl+d
      process.exit();
    } 
    else if (chr === 13 || chr === 10) { // enter
      buffer = '';
    } else {
      buffer += data;
      ctrlC = false;
    }
  });

  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
}

function setupRestartSignals(config) {
  if (config.required) return;

  const restartSignal = config.options.signal === 'SIGUSR2' ? 'SIGHUP' : 'SIGUSR2';
  process.on(restartSignal, nodemon.restart);
  bus.on('error', () => utils.log.fail(new Error().stack));

  utils.log.detail((config.options.restartable ? 'or ' : '') +
    'send ' + restartSignal + ' to ' + process.pid + ' to restart');
}

function logWatchingPaths(config) {
  const cwd = process.cwd();

  // Ignored paths
  const ignoring = config.options.monitor
    .map(rule => {
      if (rule.startsWith('!')) {
        rule = rule.slice(1);
        if (defaults.ignoreRoot.includes(rule)) return false;
        if (rule.startsWith(cwd)) return rule.replace(cwd, '.');
        return rule;
      }
      return false;
    })
    .filter(Boolean)
    .join(' ');

  if (ignoring) utils.log.detail('ignoring: ' + ignoring);

  // Watched paths
  const watchedPaths = config.options.monitor
    .map(rule => {
      if (!rule.startsWith('!')) {
        try { return path.relative(cwd, rule); } catch (e) {}
      }
      return false;
    })
    .filter(Boolean)
    .join(' ');

  utils.log.info('watching path(s): ' + watchedPaths);
  utils.log.info('watching extensions: ' + (config.options.execOptions.ext || '(all)'));
}

function bindCustomEvents(config) {
  if (!config.options.events) return;

  Object.keys(config.options.events).forEach(key => {
    utils.log.detail('bind ' + key + ' -> `' + config.options.events[key] + '`');
    nodemon.on(key, function () {
      spawn(config.options.events[key], config, Array.from(arguments));
    });
  });
}

function dumpConfig(config) {
  const cwd = process.cwd();
  utils.log._log('log', '--------------');
  utils.log._log('log', 'node: ' + process.version);
  utils.log._log('log', 'nodemon: ' + version.pinned);
  utils.log._log('log', 'command: ' + process.argv.join(' '));
  utils.log._log('log', 'cwd: ' + cwd);
  utils.log._log('log', ['OS:', process.platform, process.arch].join(' '));
  utils.log._log('log', '--------------');
  utils.log._log('log', util.inspect(config, { depth: null }));
  utils.log._log('log', '--------------');
}
