const minimatch = require('minimatch');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('nodemon:match');
const utils = require('../utils');

module.exports = match;
module.exports.rulesToMonitor = rulesToMonitor;

/**
 * Converts watch and ignore patterns into full monitoring rules.
 */
function rulesToMonitor(watch, ignore, config) {
  watch = Array.isArray(watch) ? watch : watch ? [watch] : [];
  ignore = Array.isArray(ignore) ? ignore : ignore ? [ignore] : [];

  let monitor = [...watch];

  // Prefix ignore rules with "!"
  monitor.push(...ignore.map(rule => '!' + rule));

  const cwd = process.cwd();

  monitor = monitor.map(rule => {
    const isIgnore = rule.startsWith('!');
    if (isIgnore) rule = rule.slice(1);

    if (rule === '.' || rule === '.*') rule = '*.*';

    const fullPath = path.resolve(cwd, rule);

    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        rule = fullPath.endsWith('/') ? fullPath + '**/*' : fullPath + '/**/*';
        if (!isIgnore) config.dirs.push(fullPath);
      }
    } catch (e) {
      const base = tryBaseDir(fullPath);
      if (!isIgnore && base && !config.dirs.includes(base)) {
        config.dirs.push(base);
      }
    }

    if (rule.endsWith('/')) rule += '*';
    if (rule.endsWith('*') && !rule.endsWith('**/*') && !rule.includes('*.*')) rule += '*/*';

    return isIgnore ? '!' + rule : rule;
  });

  return monitor;
}

/**
 * Tries to get the base directory of a given path or pattern.
 */
function tryBaseDir(dir) {
  try {
    if (/[?*\{\[]+/.test(dir)) {
      const base = path.dirname(dir.replace(/([?*\{\[]+.*$)/, 'foo'));
      const stat = fs.statSync(base);
      if (stat.isDirectory()) return base;
    } else {
      const stat = fs.statSync(dir);
      if (stat.isFile() || stat.isDirectory()) return dir;
    }
  } catch (e) {}
  return false;
}

/**
 * Matches files against monitoring rules and optional extensions.
 */
function match(files, monitor, ext) {
  const cwd = process.cwd();
  const rules = monitor
    .sort((a, b) => {
      const aIgnore = a.startsWith('!');
      const bIgnore = b.startsWith('!');
      if (aIgnore) return -1;
      if (bIgnore) return 1;

      const r = b.split(path.sep).length - a.split(path.sep).length;
      return r === 0 ? b.length - a.length : r;
    })
    .map(rule => {
      if (rule.startsWith('!')) {
        if (rule.startsWith('!.')) return '!' + path.resolve(cwd, rule.slice(1));
        return '!**/' + rule.slice(1);
      }
      if (rule.startsWith('.')) return path.resolve(cwd, rule);
      if (rule.startsWith(cwd)) return rule;
      return '**/' + rule;
    });

  debug('rules', rules);

  let good = [];
  let whitelist = [];
  let ignored = 0;
  let watched = 0;
  const usedRules = [];
  const minimatchOpts = { dot: true, nocase: utils.isWindows };

  files.forEach(file => {
    file = path.resolve(cwd, file);
    let matched = false;

    for (const rule of rules) {
      const isIgnore = rule.startsWith('!');
      if (isIgnore) {
        if (!minimatch(file, rule, minimatchOpts)) {
          ignored++;
          matched = true;
          break;
        }
      } else if (minimatch(file, rule, minimatchOpts)) {
        watched++;
        if (!usedRules.includes(rule)) {
          usedRules.push(rule);
          utils.log.detail('matched rule: ' + rule);
        }

        if (rule !== '**/*' && rule.endsWith('*.*')) {
          whitelist.push(file);
        } else if (path.basename(file) === path.basename(rule)) {
          whitelist.push(file);
        } else {
          good.push(file);
        }
        matched = true;
      }
    }

    if (!matched) ignored++;
  });

  // Filter good files by extension
  if (ext) {
    ext = ext.includes(',') ? `**/*.{${ext}}` : `**/*.${ext}`;
    good = good.filter(file => minimatch(path.basename(file), ext, minimatchOpts));
    debug('good (filtered by ext)', good);
  } else {
    debug('good', good);
  }

  if (whitelist.length) debug('whitelist', whitelist);

  let result = good.concat(whitelist);

  if (utils.isWindows) {
    result = result.map(file => file.slice(0, 1).toLowerCase() + file.slice(1));
  }

  return { result, ignored, watched, total: files.length };
}
