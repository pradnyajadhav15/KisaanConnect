'use strict';

/**
 * chokidar-like FS watcher (readable refactor)
 *
 * This file is a cleaned-up, more-readable rewrite of the original module.
 * Logic, behavior and exported API are preserved.
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const sysPath = require('path');
const { promisify } = require('util');

const readdirp = require('readdirp');
const anymatch = require('anymatch').default;
const globParent = require('glob-parent');
const isGlob = require('is-glob');
const braces = require('braces');
const normalizePath = require('normalize-path');

const NodeFsHandler = require('./lib/nodefs-handler');
const FsEventsHandler = require('./lib/fsevents-handler');

const {
  EV_ALL,
  EV_READY,
  EV_ADD,
  EV_CHANGE,
  EV_UNLINK,
  EV_ADD_DIR,
  EV_UNLINK_DIR,
  EV_RAW,
  EV_ERROR,

  STR_CLOSE,
  STR_END,

  BACK_SLASH_RE,
  DOUBLE_SLASH_RE,
  SLASH_OR_BACK_SLASH_RE,
  DOT_RE,
  REPLACER_RE,

  SLASH,
  SLASH_SLASH,
  BRACE_START,
  BANG,
  ONE_DOT,
  TWO_DOTS,
  GLOBSTAR,
  SLASH_GLOBSTAR,
  ANYMATCH_OPTS,
  STRING_TYPE,
  FUNCTION_TYPE,
  EMPTY_STR,
  EMPTY_FN,

  isWindows,
  isMacos,
  isIBMi
} = require('./lib/constants');

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/* -------------------------
   Small utility helpers
   ------------------------- */

const arrify = (val = []) => Array.isArray(val) ? val : [val];

const flatten = (list, out = []) => {
  list.forEach(item => {
    if (Array.isArray(item)) {
      flatten(item, out);
    } else {
      out.push(item);
    }
  });
  return out;
};

// Normalize backslashes & repeated slashes -> Unix-style path
const toUnix = (input) => {
  let s = input.replace(BACK_SLASH_RE, SLASH);
  // Preserve leading double-slash for UNC/network paths.
  let preserveLeadingDoubleSlash = false;
  if (s.startsWith(SLASH_SLASH)) {
    preserveLeadingDoubleSlash = true;
  }
  while (s.match(DOUBLE_SLASH_RE)) {
    s = s.replace(DOUBLE_SLASH_RE, SLASH);
  }
  if (preserveLeadingDoubleSlash) s = SLASH + s;
  return s;
};

// Normalize using node path.normalize but keep Unix separators
const normalizePathToUnix = (p) => toUnix(sysPath.normalize(toUnix(p)));

const normalizeIgnored = (cwd = EMPTY_STR) => (p) => {
  if (typeof p !== STRING_TYPE) return p;
  if (sysPath.isAbsolute(p)) {
    return normalizePathToUnix(p);
  }
  return normalizePathToUnix(sysPath.join(cwd, p));
};

const getAbsolutePath = (path, cwd) => {
  if (sysPath.isAbsolute(path)) return path;
  if (path.startsWith(BANG)) return BANG + sysPath.join(cwd, path.slice(1));
  return sysPath.join(cwd, path);
};

const optionUndefined = (opts, key) => opts[key] === undefined;

/* -------------------------
   DirEntry: tracks children of a directory
   ------------------------- */
class DirEntry {
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = new Set();
  }

  add(item) {
    if (!this.items) return;
    if (item !== ONE_DOT && item !== TWO_DOTS) this.items.add(item);
  }

  async remove(item) {
    if (!this.items) return;
    this.items.delete(item);
    if (this.items.size > 0) return;

    // If directory is now empty, check filesystem; if it's truly gone, remove watcher
    try {
      await readdir(this.path);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sysPath.dirname(this.path), sysPath.basename(this.path));
      }
    }
  }

  has(item) {
    if (!this.items) return;
    return this.items.has(item);
  }

  getChildren() {
    if (!this.items) return;
    return [...this.items.values()];
  }

  dispose() {
    this.items.clear();
    delete this.path;
    delete this._removeWatcher;
    delete this.items;
    Object.freeze(this);
  }
}

/* -------------------------
   WatchHelper: encapsulates glob/symlink helpers per watch target
   ------------------------- */
const STAT_METHOD_F = 'stat';
const STAT_METHOD_L = 'lstat';

class WatchHelper {
  constructor(originalPath, watchPath, followSymlinks, fsWatcher) {
    this.fsw = fsWatcher;

    // remove leading './' if any
    this.path = originalPath.replace(REPLACER_RE, EMPTY_STR);
    this.watchPath = watchPath;
    this.fullWatchPath = sysPath.resolve(watchPath);

    this.hasGlob = (watchPath !== this.path);
    if (this.path === EMPTY_STR) this.hasGlob = false;

    // if hasGlob and followSymlinks requested -> keep undefined until we inspect entries
    this.globSymlink = this.hasGlob && followSymlinks ? undefined : (this.hasGlob ? false : false);
    this.globFilter = this.hasGlob ? anymatch(this.path, undefined, ANYMATCH_OPTS) : false;

    this.dirParts = this._getDirParts(this.path);
    // For matching directory names we only care about the parent portions:
    this.dirParts.forEach(parts => {
      if (parts.length > 1) parts.pop();
    });

    this.followSymlinks = followSymlinks;
    this.statMethod = followSymlinks ? STAT_METHOD_F : STAT_METHOD_L;
  }

  // If glob included and following symlinks, determine mapping for this entry
  checkGlobSymlink(entry) {
    if (this.globSymlink === undefined) {
      // entry.fullParentDir is set by readdirp: the parent dir of the found entry
      this.globSymlink = (entry.fullParentDir === this.fullWatchPath)
        ? false
        : { realPath: entry.fullParentDir, linkPath: this.fullWatchPath };
    }

    if (this.globSymlink) {
      return entry.fullPath.replace(this.globSymlink.realPath, this.globSymlink.linkPath);
    }
    return entry.fullPath;
  }

  entryPath(entry) {
    return sysPath.join(this.watchPath, sysPath.relative(this.watchPath, this.checkGlobSymlink(entry)));
  }

  filterPath(entry) {
    const { stats } = entry;
    // if symlink, defer to directory filter
    if (stats && stats.isSymbolicLink()) return this.filterDir(entry);

    const resolved = this.entryPath(entry);
    const matchesGlob = this.hasGlob && typeof this.globFilter === FUNCTION_TYPE
      ? this.globFilter(resolved)
      : true;

    return matchesGlob &&
      this.fsw._isntIgnored(resolved, stats) &&
      this.fsw._hasReadPermissions(stats);
  }

  _getDirParts(path) {
    if (!this.hasGlob) return [];
    const parts = [];
    const expandedPaths = path.includes(BRACE_START) ? braces.expand(path) : [path];
    expandedPaths.forEach((p) => {
      parts.push(sysPath.relative(this.watchPath, p).split(SLASH_OR_BACK_SLASH_RE));
    });
    return parts;
  }

  filterDir(entry) {
    if (this.hasGlob) {
      const entryParts = this._getDirParts(this.checkGlobSymlink(entry));
      let globstarSeen = false;
      this.unmatchedGlob = !this.dirParts.some(parts => {
        return parts.every((part, i) => {
          if (part === GLOBSTAR) globstarSeen = true;
          return globstarSeen || !entryParts[0][i] || anymatch(part, entryParts[0][i], ANYMATCH_OPTS);
        });
      });
    }
    return !this.unmatchedGlob && this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
}

/* -------------------------
   FSWatcher: main class
   ------------------------- */
class FSWatcher extends EventEmitter {
  constructor(userOptions) {
    super();

    const opts = {};
    if (userOptions) Object.assign(opts, userOptions); // allow frozen input

    // internal trackers
    this._watched = new Map();        // Map<dirPath, DirEntry>
    this._closers = new Map();        // Map<path, Array<closer functions>>
    this._ignoredPaths = new Set();   // Set<string> of ignored paths
    this._throttled = new Map();      // Map<throttleType, Map<path, throttleObj>>
    this._symlinkPaths = new Map();   // Map<path, targetPath or flag>
    this._streams = new Set();        // readdirp streams
    this.closed = false;

    // default options
    if (optionUndefined(opts, 'persistent')) opts.persistent = true;
    if (optionUndefined(opts, 'ignoreInitial')) opts.ignoreInitial = false;
    if (optionUndefined(opts, 'ignorePermissionErrors')) opts.ignorePermissionErrors = false;
    if (optionUndefined(opts, 'interval')) opts.interval = 100;
    if (optionUndefined(opts, 'binaryInterval')) opts.binaryInterval = 300;
    if (optionUndefined(opts, 'disableGlobbing')) opts.disableGlobbing = false;
    opts.enableBinaryInterval = opts.binaryInterval !== opts.interval;

    // prefer fsevents on OS X unless polling forced
    if (optionUndefined(opts, 'useFsEvents')) opts.useFsEvents = !opts.usePolling;
    const canUseFsEvents = FsEventsHandler.canUse();
    if (!canUseFsEvents) opts.useFsEvents = false;

    // pick default usePolling by platform
    if (optionUndefined(opts, 'usePolling') && !opts.useFsEvents) {
      opts.usePolling = isMacos;
    }
    // IBM i doesn't have fs.watch -> force polling
    if (isIBMi) opts.usePolling = true;

    // respect environment overrides
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== undefined) {
      const envLower = envPoll.toLowerCase();
      if (envLower === 'false' || envLower === '0') opts.usePolling = false;
      else if (envLower === 'true' || envLower === '1') opts.usePolling = true;
      else opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval) opts.interval = Number.parseInt(envInterval, 10);

    // atomic write handling (editor atomic saves) default for non-polling
    if (optionUndefined(opts, 'atomic')) opts.atomic = !opts.usePolling && !opts.useFsEvents;
    if (opts.atomic) this._pendingUnlinks = new Map();

    if (optionUndefined(opts, 'followSymlinks')) opts.followSymlinks = true;

    // awaitWriteFinish handling
    if (optionUndefined(opts, 'awaitWriteFinish')) opts.awaitWriteFinish = false;
    if (opts.awaitWriteFinish === true) opts.awaitWriteFinish = {};
    const awf = opts.awaitWriteFinish;
    if (awf) {
      if (!awf.stabilityThreshold) awf.stabilityThreshold = 2000;
      if (!awf.pollInterval) awf.pollInterval = 100;
      this._pendingWrites = new Map();
    }
    if (opts.ignored) opts.ignored = arrify(opts.ignored);

    // ready/emit helpers
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EV_READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EV_RAW, ...args);
    this._readyEmitted = false;
    this.options = opts;

    // choose the best handler
    if (opts.useFsEvents) {
      this._fsEventsHandler = new FsEventsHandler(this);
    } else {
      this._nodeFsHandler = new NodeFsHandler(this);
    }

    // freeze options to avoid accidental modification
    Object.freeze(opts);
  }

  /* -------------------------
     Public API
     ------------------------- */

  add(paths_, _origAdd, _internal) {
    const { cwd, disableGlobbing } = this.options;
    this.closed = false;

    // normalize and flatten inputs
    let paths = unifyPaths(paths_);

    if (cwd) {
      paths = paths.map((p) => {
        const absPath = getAbsolutePath(p, cwd);
        // if not disabling globbing and the user provided a glob, keep normalized form
        if (disableGlobbing || !isGlob(p)) {
          return absPath;
        }
        return normalizePath(absPath);
      });
    }

    // handle negated globs (leading '!')
    paths = paths.filter((p) => {
      if (p.startsWith(BANG)) {
        this._ignoredPaths.add(p.slice(1));
        return false;
      }
      // if path was previously ignored, un-ignore
      this._ignoredPaths.delete(p);
      this._ignoredPaths.delete(p + SLASH_GLOBSTAR);
      // reset cached userIgnored matcher so ignore changes take effect
      this._userIgnored = undefined;
      return true;
    });

    // choose which handler to use
    if (this.options.useFsEvents && this._fsEventsHandler) {
      if (!this._readyCount) this._readyCount = paths.length;
      if (this.options.persistent) this._readyCount += paths.length;
      paths.forEach((p) => this._fsEventsHandler._addToFsEvents(p));
    } else {
      if (!this._readyCount) this._readyCount = 0;
      this._readyCount += paths.length;
      Promise.all(
        paths.map(async path => {
          const res = await this._nodeFsHandler._addToNodeFs(path, !_internal, 0, 0, _origAdd);
          if (res) this._emitReady();
          return res;
        })
      ).then(results => {
        if (this.closed) return;
        results.filter(Boolean).forEach(missing => {
          this.add(sysPath.dirname(missing), sysPath.basename(_origAdd || missing));
        });
      });
    }

    return this;
  }

  unwatch(paths_) {
    if (this.closed) return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;

    paths.forEach((p) => {
      // convert to absolute if necessary
      if (!sysPath.isAbsolute(p) && !this._closers.has(p)) {
        if (cwd) p = sysPath.join(cwd, p);
        p = sysPath.resolve(p);
      }

      this._closePath(p);

      this._ignoredPaths.add(p);
      if (this._watched.has(p)) {
        this._ignoredPaths.add(p + SLASH_GLOBSTAR);
      }

      // reset cached userIgnored matcher so ignore changes take effect
      this._userIgnored = undefined;
    });

    return this;
  }

  close() {
    if (this.closed) return this._closePromise;
    this.closed = true;

    this.removeAllListeners();

    const closersPromises = [];
    this._closers.forEach(closerList => closerList.forEach(closer => {
      const maybePromise = closer();
      if (maybePromise instanceof Promise) closersPromises.push(maybePromise);
    }));

    this._streams.forEach(stream => stream.destroy());
    this._userIgnored = undefined;
    this._readyCount = 0;
    this._readyEmitted = false;

    this._watched.forEach(entry => entry.dispose());

    ['closers', 'watched', 'streams', 'symlinkPaths', 'throttled'].forEach(key => {
      this[`_${key}`].clear();
    });

    this._closePromise = closersPromises.length ? Promise.all(closersPromises).then(() => undefined) : Promise.resolve();
    return this._closePromise;
  }

  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sysPath.relative(this.options.cwd, dir) : dir;
      watchList[key || ONE_DOT] = entry.getChildren().sort();
    });
    return watchList;
  }

  emitWithAll(event, args) {
    this.emit(...args);
    if (event !== EV_ERROR) this.emit(EV_ALL, ...args);
  }

  /* -------------------------
     Core internal helpers
     ------------------------- */

  async _emit(event, path, val1, val2, val3) {
    if (this.closed) return;

    const opts = this.options;
    if (isWindows) path = sysPath.normalize(path);
    if (opts.cwd) path = sysPath.relative(opts.cwd, path);

    // build args array for emit
    const args = [event, path];
    if (val3 !== undefined) args.push(val1, val2, val3);
    else if (val2 !== undefined) args.push(val1, val2);
    else if (val1 !== undefined) args.push(val1);

    // If awaiting writes: postpone emission until file is stable
    const awf = opts.awaitWriteFinish;
    if (awf && this._pendingWrites && this._pendingWrites.get(path)) {
      this._pendingWrites.get(path).lastChange = new Date();
      return this;
    }

    // atomic behavior: delay emits for unlink/add race conditions
    if (opts.atomic) {
      if (event === EV_UNLINK) {
        this._pendingUnlinks.set(path, args);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, pth) => {
            this.emit(...entry);
            this.emit(EV_ALL, ...entry);
            this._pendingUnlinks.delete(pth);
          });
        }, typeof opts.atomic === 'number' ? opts.atomic : 100);
        return this;
      }
      if (event === EV_ADD && this._pendingUnlinks.has(path)) {
        event = args[0] = EV_CHANGE;
        this._pendingUnlinks.delete(path);
      }
    }

    // awaitWriteFinish branch: keep polling until stable then emit
    if (awf && (event === EV_ADD || event === EV_CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats) => {
        if (err) {
          event = args[0] = EV_ERROR;
          args[1] = err;
          this.emitWithAll(event, args);
        } else if (stats) {
          if (args.length > 2) args[2] = stats;
          else args.push(stats);
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path, awf.stabilityThreshold, event, awfEmit);
      return this;
    }

    // throttle change events
    if (event === EV_CHANGE) {
      const isThrottled = !this._throttle(EV_CHANGE, path, 50);
      if (isThrottled) return this;
    }

    // optionally gather stat before emitting (alwaysStat)
    if (opts.alwaysStat && val1 === undefined &&
      (event === EV_ADD || event === EV_ADD_DIR || event === EV_CHANGE)
    ) {
      const fullPath = opts.cwd ? sysPath.join(opts.cwd, path) : path;
      let stats;
      try { stats = await stat(fullPath); } catch (err) {}
      if (!stats || this.closed) return;
      args.push(stats);
    }

    this.emitWithAll(event, args);
    return this;
  }

  _handleError(error) {
    const code = error && error.code;
    if (error && code !== 'ENOENT' && code !== 'ENOTDIR' &&
      (!this.options.ignorePermissionErrors || (code !== 'EPERM' && code !== 'EACCES'))
    ) {
      this.emit(EV_ERROR, error);
    }
    return error || this.closed;
  }

  _throttle(actionType, path, timeout) {
    if (!this._throttled.has(actionType)) this._throttled.set(actionType, new Map());
    const actionMap = this._throttled.get(actionType);
    const existing = actionMap.get(path);
    if (existing) {
      existing.count++;
      return false;
    }

    let timeoutObject;
    const clear = () => {
      const item = actionMap.get(path);
      const count = item ? item.count : 0;
      actionMap.delete(path);
      clearTimeout(timeoutObject);
      if (item) clearTimeout(item.timeoutObject);
      return count;
    };

    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    actionMap.set(path, thr);
    return thr;
  }

  _incrReadyCount() {
    return this._readyCount++;
  }

  _awaitWriteFinish(path, threshold, event, awfEmit) {
    let timeoutHandle;

    let fullPath = path;
    if (this.options.cwd && !sysPath.isAbsolute(path)) {
      fullPath = sysPath.join(this.options.cwd, path);
    }

    const now = new Date();

    const poll = (prevStat) => {
      fs.stat(fullPath, (err, curStat) => {
        if (err || !this._pendingWrites.has(path)) {
          if (err && err.code !== 'ENOENT') awfEmit(err);
          return;
        }

        const nowNum = Number(new Date());

        if (prevStat && curStat.size !== prevStat.size) {
          this._pendingWrites.get(path).lastChange = nowNum;
        }
        const pw = this._pendingWrites.get(path);
        const dt = nowNum - pw.lastChange;

        if (dt >= threshold) {
          this._pendingWrites.delete(path);
          awfEmit(undefined, curStat);
        } else {
          timeoutHandle = setTimeout(poll, this.options.awaitWriteFinish.pollInterval, curStat);
        }
      });
    };

    if (!this._pendingWrites.has(path)) {
      this._pendingWrites.set(path, {
        lastChange: now,
        cancelWait: () => {
          this._pendingWrites.delete(path);
          clearTimeout(timeoutHandle);
          return event;
        }
      });
      timeoutHandle = setTimeout(poll, this.options.awaitWriteFinish.pollInterval);
    }
  }

  _getGlobIgnored() {
    return [...this._ignoredPaths.values()];
  }

  _isIgnored(path, stats) {
    // if atomic and dotfile -> ignore
    if (this.options.atomic && DOT_RE.test(path)) return true;

    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = ign && ign.map(normalizeIgnored(cwd));
      const paths = arrify(ignored)
        .filter((p) => typeof p === STRING_TYPE && !isGlob(p))
        .map((p) => p + SLASH_GLOBSTAR);
      const list = this._getGlobIgnored().map(normalizeIgnored(cwd)).concat(ignored, paths);
      this._userIgnored = anymatch(list, undefined, ANYMATCH_OPTS);
    }

    return this._userIgnored([path, stats]);
  }

  _isntIgnored(path, stat) {
    return !this._isIgnored(path, stat);
  }

  _getWatchHelpers(path, depth) {
    const watchPath = depth || this.options.disableGlobbing || !isGlob(path) ? path : globParent(path);
    const follow = this.options.followSymlinks;
    return new WatchHelper(path, watchPath, follow, this);
  }

  /* -------------------------
     Directory and file tracking helpers
     ------------------------- */

  _getWatchedDir(directory) {
    if (!this._boundRemove) this._boundRemove = this._remove.bind(this);
    const dir = sysPath.resolve(directory);
    if (!this._watched.has(dir)) this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }

  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors) return true;
    const md = stats && Number.parseInt(stats.mode, 10);
    const st = md & 0o777;
    const ownerPerm = Number.parseInt(st.toString(8)[0], 10);
    return Boolean(4 & ownerPerm);
  }

  _remove(directory, item, isDirectory) {
    const path = sysPath.join(directory, item);
    const fullPath = sysPath.resolve(path);

    isDirectory = (isDirectory != null)
      ? isDirectory
      : (this._watched.has(path) || this._watched.has(fullPath));

    // throttle removes to avoid duplicate handling
    if (!this._throttle('remove', path, 100)) return;

    // track watching of directory when single file removed and not using fsevents
    if (!isDirectory && !this.options.useFsEvents && this._watched.size === 1) {
      this.add(directory, item, true);
    }

    // get the directory entry and children (if any)
    const wp = this._getWatchedDir(path);
    const nestedChildren = wp.getChildren();

    // recursively remove children
    nestedChildren.forEach(nested => this._remove(path, nested));

    // remove item from parent entry
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);

    // cleanup symlink mapping if present
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }

    // if waiting for write finish for this relPath, cancel it
    let relPath = path;
    if (this.options.cwd) relPath = sysPath.relative(this.options.cwd, path);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EV_ADD) return;
    }

    // finally delete from watched maps and emit unlink/unlinkDir as needed
    this._watched.delete(path);
    this._watched.delete(fullPath);
    const eventName = isDirectory ? EV_UNLINK_DIR : EV_UNLINK;
    if (wasTracked && !this._isIgnored(path)) this._emit(eventName, path);

    // If not using fsevents, close watchers for that path
    if (!this.options.useFsEvents) this._closePath(path);
  }

  _closePath(path) {
    this._closeFile(path);
    const dir = sysPath.dirname(path);
    this._getWatchedDir(dir).remove(sysPath.basename(path));
  }

  _closeFile(path) {
    const closers = this._closers.get(path);
    if (!closers) return;
    closers.forEach(closer => closer());
    this._closers.delete(path);
  }

  _addPathCloser(path, closer) {
    if (!closer) return;
    let list = this._closers.get(path);
    if (!list) {
      list = [];
      this._closers.set(path, list);
    }
    list.push(closer);
  }

  _readdirp(root, opts) {
    if (this.closed) return;
    const options = { type: EV_ALL, alwaysStat: true, lstat: true, ...opts };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = undefined;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = undefined;
      }
    });
    return stream;
  }
}

/* -------------------------
   Utilities used by public methods
   ------------------------- */

// Convert user input to normalized absolute/unix-style paths
function unifyPaths(paths_) {
  const paths = flatten(arrify(paths_));
  if (!paths.every(p => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
}

/* -------------------------
   Export
   ------------------------- */

exports.FSWatcher = FSWatcher;

const watch = (paths, options) => {
  const w = new FSWatcher(options);
  w.add(paths);
  return w;
};

exports.watch = watch;
