const chokidar = require('chokidar');
const path = require('path');
const undefsafe = require('undefsafe');
const debug = require('debug')('nodemon:watch');
const debugRoot = require('debug')('nodemon');

const config = require('../config');
const utils = require('../utils');
const bus = utils.bus;
const match = require('./match');

let watchers = [];
let debouncedBus;
let watchedFiles = [];

// Export functions
module.exports.watch = watch;
module.exports.resetWatchers = resetWatchers;

// Reset all watchers
bus.on('reset', resetWatchers);
function resetWatchers() {
  debugRoot('resetting watchers');
  watchers.forEach(watcher => watcher.close());
  watchers = [];
}

// Start watching directories/files
function watch() {
  if (watchers.length) {
    debug('already watching %s paths', watchers.length);
    return;
  }

  const dirs = Array.from(config.dirs);
  const rootIgnored = config.options.ignore || [];

  debugRoot('start watch on: %s', dirs.join(', '));
  debugRoot('ignored', rootIgnored);

  watchedFiles = [];

  const promise = new Promise(resolve => {
    const dotFilePattern = /[/\\]\./;

    // Build ignore patterns
    let ignored = match.rulesToMonitor([], rootIgnored, config)
      .map(p => p.slice(1));

    // Only ignore dotfiles if they are not explicitly watched
    const addDotFile = dirs.filter(dir => dir.match(dotFilePattern));
    if (!addDotFile.length) ignored.push(dotFilePattern);

    const watchOptions = {
      ignorePermissionErrors: true,
      ignored,
      persistent: true,
      usePolling: config.options.legacyWatch || false,
      interval: config.options.pollingInterval,
    };

    if (utils.isWindows) watchOptions.disableGlobbing = true;
    if (utils.isIBMi) watchOptions.usePolling = true;
    if (process.env.TEST) watchOptions.useFsEvents = false;

    const watcher = chokidar.watch(
      dirs,
      Object.assign({}, watchOptions, config.options.watchOptions || {})
    );

    watcher.ready = false;

    watcher.on('change', filterAndRestart);
    watcher.on('unlink', filterAndRestart);
    watcher.on('add', file => {
      if (watcher.ready) return filterAndRestart(file);

      watchedFiles.push(file);
      bus.emit('watching', file);
      debug('chokidar watching: %s', file);
    });

    watcher.on('ready', () => {
      watchedFiles = Array.from(new Set(watchedFiles)); // remove duplicates
      watcher.ready = true;
      debugRoot('watch is complete');
      resolve(watchedFiles.length);
    });

    watcher.on('error', error => {
      if (error.code === 'EINVAL') {
        utils.log.error('Too many files being watched. Check https://github.com/paulmillr/chokidar/issues/229');
      } else {
        utils.log.error('Internal watch failed: ' + error.message);
      }
      process.exit(1);
    });

    watchers.push(watcher);
  });

  return promise
    .catch(e => setTimeout(() => { throw e; }))
    .then(() => {
      utils.log.detail(`watching ${watchedFiles.length} file${watchedFiles.length === 1 ? '' : 's'}`);
      return watchedFiles;
    });
}

// Filter changed files and trigger restart if needed
function filterAndRestart(files) {
  if (!Array.isArray(files)) files = [files];

  if (!files.length) return;

  const cwd = this?.options?.cwd || process.cwd();

  utils.log.detail(
    'files triggering change check: ' + files.map(f => path.relative(cwd, f)).join(', ')
  );

  files = files.filter(Boolean).map(f => path.relative(process.cwd(), path.relative(cwd, f)));

  if (utils.isWindows) {
    files = files.map(f => f.includes(':') ? f[0].toUpperCase() + f.slice(1) : f);
  }

  const matched = match(
    files,
    config.options.monitor,
    undefsafe(config, 'options.execOptions.ext')
  );

  // Special case: check if running script changed
  const script = undefsafe(config, 'options.execOptions.script');
  if (matched.result.length === 0 && script) {
    const scriptFile = path.resolve(script);
    files.find(file => {
      if (file.endsWith(scriptFile)) {
        matched.result = [file];
        matched.total = 1;
        return true;
      }
    });
  }

  utils.log.detail('changes after filters (before/after): ' + [files.length, matched.result.length].join('/'));

  config.lastStarted = Date.now();

  if (matched.result.length) {
    if (config.options.delay > 0) {
      if (!debouncedBus) debouncedBus = debounce(restartBus, config.options.delay);
      debouncedBus(matched);
    } else {
      restartBus(matched);
    }
  }
}

// Emit restart event
function restartBus(matched) {
  utils.log.status('restarting due to changes...');
  matched.result.forEach(file => utils.log.detail(path.relative(process.cwd(), file)));
  if (config.options.verbose) utils.log._log('');
  bus.emit('restart', matched.result);
}

// Simple debounce helper
function debounce(fn, delay) {
  let timer = null;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, arguments), delay);
  };
}
