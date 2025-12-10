'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const isBinaryPath = require('is-binary-path');

const {
  isWindows,
  isLinux,
  EMPTY_FN,
  EMPTY_STR,
  KEY_LISTENERS,
  KEY_ERR,
  KEY_RAW,
  HANDLER_KEYS,
  EV_CHANGE,
  EV_ADD,
  EV_ADD_DIR,
  EV_ERROR,
  STR_DATA,
  STR_END,
  BRACE_START,
  STAR
} = require('./constants');

/** Promisified FS methods */
const openFile = promisify(fs.open);
const stat = promisify(fs.stat);
const lstat = promisify(fs.lstat);
const closeFile = promisify(fs.close);
const realpath = promisify(fs.realpath);

/** Map for switching stat method easily */
const statMethods = { lstat, stat };

/** Throttle mode id */
const THROTTLE_MODE_WATCH = 'watch';

/* -------------------------------------------------------------------------- */
/*                              Utility Functions                             */
/* -------------------------------------------------------------------------- */

const forEachSetOrValue = (value, callback) => {
  if (value instanceof Set) value.forEach(callback);
  else callback(value);
};

const addAsSet = (obj, prop, value) => {
  if (!(obj[prop] instanceof Set)) {
    obj[prop] = new Set([obj[prop]]);
  }
  obj[prop].add(value);
};

const clearContainerItem = container => key => {
  const val = container[key];
  if (val instanceof Set) val.clear();
  else delete container[key];
};

const deleteFromSet = (obj, prop, value) => {
  const setOrValue = obj[prop];
  if (setOrValue instanceof Set) {
    setOrValue.delete(value);
  } else if (setOrValue === value) {
    delete obj[prop];
  }
};

const isSetEmpty = value =>
  value instanceof Set ? value.size === 0 : !value;

/* -------------------------------------------------------------------------- */
/*                         fs.watch Per-Path Instance Map                     */
/* -------------------------------------------------------------------------- */

/**
 * Map<absolutePath, {listeners, errHandlers, rawEmitters, watcher, watcherUnusable}>
 */
const FsWatchInstances = new Map();

/**
 * Create an fs.watch for a path
 */
function createFsWatchInstance(watchPath, options, listener, errHandler, emitRaw) {
  const handle = (rawEvent, eventPath) => {
    listener(watchPath);
    emitRaw(rawEvent, eventPath, { watchedPath: watchPath });

    // Propagate events for nested files
    if (eventPath && watchPath !== eventPath) {
      const resolved = path.resolve(watchPath, eventPath);
      fsWatchBroadcast(resolved, KEY_LISTENERS, path.join(watchPath, eventPath));
    }
  };

  try {
    return fs.watch(watchPath, options, handle);
  } catch (error) {
    errHandler(error);
  }
}

/** Broadcast events to listeners of a watched path */
const fsWatchBroadcast = (fullPath, type, v1, v2, v3) => {
  const container = FsWatchInstances.get(fullPath);
  if (!container) return;
  forEachSetOrValue(container[type], fn => fn(v1, v2, v3));
};

/**
 * Create or reuse fs.watch instance for a path
 */
const setFsWatchListener = (pathArg, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;

  let container = FsWatchInstances.get(fullPath);
  let watcher;

  // Non-persistent watchers always create new instances
  if (!options.persistent) {
    watcher = createFsWatchInstance(pathArg, options, listener, errHandler, rawEmitter);
    return watcher.close.bind(watcher);
  }

  if (container) {
    // Attach listeners to existing fs.watch instance
    addAsSet(container, KEY_LISTENERS, listener);
    addAsSet(container, KEY_ERR, errHandler);
    addAsSet(container, KEY_RAW, rawEmitter);
  } else {
    // Create new fs.watch instance
    watcher = createFsWatchInstance(
      pathArg,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );

    if (!watcher) return;

    watcher.on(EV_ERROR, async error => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      container.watcherUnusable = true;

      // Windows EPERM workaround
      if (isWindows && error.code === 'EPERM') {
        try {
          const fd = await openFile(pathArg, 'r');
          await closeFile(fd);
          broadcastErr(error);
        } catch {}
      } else {
        broadcastErr(error);
      }
    });

    container = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };

    FsWatchInstances.set(fullPath, container);
  }

  /** Remove listener + close watcher if no listeners left */
  return () => {
    deleteFromSet(container, KEY_LISTENERS, listener);
    deleteFromSet(container, KEY_ERR, errHandler);
    deleteFromSet(container, KEY_RAW, rawEmitter);

    if (isSetEmpty(container.listeners)) {
      container.watcher.close();
      FsWatchInstances.delete(fullPath);

      HANDLER_KEYS.forEach(clearContainerItem(container));
      container.watcher = undefined;
      Object.freeze(container);
    }
  };
};

/* -------------------------------------------------------------------------- */
/*                             fs.watchFile helpers                           */
/* -------------------------------------------------------------------------- */

const FsWatchFileInstances = new Map();

/**
 * Create or reuse fs.watchFile watcher
 */
const setFsWatchFileListener = (pathArg, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;

  let container = FsWatchFileInstances.get(fullPath);
  let listeners = new Set();
  let rawEmitters = new Set();

  const existingOpts = container && container.options;

  // Upgrade interval/persistence when needed
  if (
    existingOpts &&
    (existingOpts.persistent < options.persistent ||
      existingOpts.interval > options.interval)
  ) {
    listeners = container.listeners;
    rawEmitters = container.rawEmitters;
    fs.unwatchFile(fullPath);
    container = undefined;
  }

  if (container) {
    addAsSet(container, KEY_LISTENERS, listener);
    addAsSet(container, KEY_RAW, rawEmitter);
  } else {
    container = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: fs.watchFile(fullPath, options, (curr, prev) => {
        forEachSetOrValue(container.rawEmitters, fn =>
          fn(EV_CHANGE, fullPath, { curr, prev })
        );

        const currTime = curr.mtimeMs;
        if (
          curr.size !== prev.size ||
          currTime > prev.mtimeMs ||
          currTime === 0
        ) {
          forEachSetOrValue(container.listeners, fn => fn(pathArg, curr));
        }
      })
    };

    FsWatchFileInstances.set(fullPath, container);
  }

  return () => {
    deleteFromSet(container, KEY_LISTENERS, listener);
    deleteFromSet(container, KEY_RAW, rawEmitter);

    if (isSetEmpty(container.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      fs.unwatchFile(fullPath);
      container.options = container.watcher = undefined;
      Object.freeze(container);
    }
  };
};

/* -------------------------------------------------------------------------- */
/*                               NodeFsHandler                                */
/* -------------------------------------------------------------------------- */

class NodeFsHandler {
  constructor(fsWatcher) {
    this.fsw = fsWatcher;
    this._boundHandleError = err => fsWatcher._handleError(err);
  }

  /**
   * Watch path using fs.watch or fs.watchFile
   */
  _watchWithNodeFs(pathArg, listener = EMPTY_FN) {
    const opts = this.fsw.options;
    const directory = path.dirname(pathArg);
    const basename = path.basename(pathArg);

    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename);

    const absolutePath = path.resolve(pathArg);
    const watchOptions = { persistent: opts.persistent };

    let stopWatching;

    if (opts.usePolling) {
      watchOptions.interval =
        opts.enableBinaryInterval && isBinaryPath(basename)
          ? opts.binaryInterval
          : opts.interval;

      stopWatching = setFsWatchFileListener(pathArg, absolutePath, watchOptions, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      stopWatching = setFsWatchListener(pathArg, absolutePath, watchOptions, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }

    return stopWatching;
  }

  /**
   * Handle file changes for normal files
   */
  _handleFile(filePath, stats, initialAdd) {
    if (this.fsw.closed) return;

    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath);
    const parent = this.fsw._getWatchedDir(dirname);

    if (parent.has(basename)) return;

    let prevStats = stats;

    const listener = async (_, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, filePath, 5)) return;

      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const freshStats = await stat(filePath);
          if (this.fsw.closed) return;

          const { atimeMs: at, mtimeMs: mt } = freshStats;

          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV_CHANGE, filePath, freshStats);
          }

          // Linux inode change detection
          if (isLinux && prevStats.ino !== freshStats.ino) {
            this.fsw._closeFile(filePath);
            prevStats = freshStats;

            this.fsw._addPathCloser(
              filePath,
              this._watchWithNodeFs(filePath, listener)
            );
          } else {
            prevStats = freshStats;
          }
        } catch {
          this.fsw._remove(dirname, basename);
        }
      } else {
        const { atimeMs: at, mtimeMs: mt } = newStats;

        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV_CHANGE, filePath, newStats);
        }

        prevStats = newStats;
      }
    };

    const closer = this._watchWithNodeFs(filePath, listener);

    if (
      !(initialAdd && this.fsw.options.ignoreInitial) &&
      this.fsw._isntIgnored(filePath)
    ) {
      if (!this.fsw._throttle(EV_ADD, filePath, 0)) return;
      this.fsw._emit(EV_ADD, filePath, stats);
    }

    return closer;
  }

  /**
   * Handle symlink during directory scanning
   */
  async _handleSymlink(entry, directory, filePath, item) {
    if (this.fsw.closed) return;
    const fullPath = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);

    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();

      let resolved;
      try {
        resolved = await realpath(filePath);
      } catch {
        this.fsw._emitReady();
        return true;
      }

      if (this.fsw.closed) return;

      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(fullPath) !== resolved) {
          this.fsw._symlinkPaths.set(fullPath, resolved);
          this.fsw._emit(EV_CHANGE, filePath, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(fullPath, resolved);
        this.fsw._emit(EV_ADD, filePath, entry.stats);
      }

      this.fsw._emitReady();
      return true;
    }

    // If already followed before, skip
    if (this.fsw._symlinkPaths.has(fullPath)) return true;

    this.fsw._symlinkPaths.set(fullPath, true);
  }

  /* ---------------------------------------------------------------------- */
  /*                            Directory Reading                           */
  /* ---------------------------------------------------------------------- */

  _handleRead(dirPath, initialAdd, wh, target, baseDir, depth, throttler) {
    dirPath = path.join(dirPath, EMPTY_STR);

    if (!wh.hasGlob) {
      throttler = this.fsw._throttle('readdir', dirPath, 1000);
      if (!throttler) return;
    }

    const previous = this.fsw._getWatchedDir(wh.path);
    const currentItems = new Set();

    let stream = this.fsw
      ._readdirp(dirPath, {
        fileFilter: entry => wh.filterPath(entry),
        directoryFilter: entry => wh.filterDir(entry),
        depth: 0
      })
      .on(STR_DATA, async entry => {
        if (this.fsw.closed) {
          stream = undefined;
          return;
        }

        const item = entry.path;
        let filePath = path.join(dirPath, item);

        currentItems.add(item);

        if (
          entry.stats.isSymbolicLink() &&
          (await this._handleSymlink(entry, dirPath, filePath, item))
        ) {
          return;
        }

        if (this.fsw.closed) {
          stream = undefined;
          return;
        }

        const isNew =
          item === target || (!target && !previous.has(item));

        if (isNew) {
          this.fsw._incrReadyCount();

          filePath = path.join(baseDir, path.relative(baseDir, filePath));
          this._addToNodeFs(filePath, initialAdd, wh, depth + 1);
        }
      })
      .on(EV_ERROR, this._boundHandleError);

    return new Promise(resolve => {
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = undefined;
          return;
        }

        const wasThrottled = throttler ? throttler.clear() : false;
        resolve();

        // Detect removed items
        previous
          .getChildren()
          .filter(item => {
            const fullItem = path.resolve(dirPath, item);

            return (
              item !== dirPath &&
              !currentItems.has(item) &&
              (!wh.hasGlob ||
                wh.filterPath({ fullPath: fullItem }))
            );
          })
          .forEach(item => this.fsw._remove(dirPath, item));

        stream = undefined;

        if (wasThrottled) {
          this._handleRead(dirPath, false, wh, target, baseDir, depth, throttler);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /*                          Directory Handling                            */
  /* ---------------------------------------------------------------------- */

  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath) {
    const parentDir = this.fsw._getWatchedDir(path.dirname(dir));
    const dirName = path.basename(dir);
    const alreadyTracked = parentDir.has(dirName);

    if (
      !(initialAdd && this.fsw.options.ignoreInitial) &&
      !target &&
      !alreadyTracked &&
      (!wh.hasGlob || wh.globFilter(dir))
    ) {
      this.fsw._emit(EV_ADD_DIR, dir, stats);
    }

    // Track directory always
    parentDir.add(dirName);
    this.fsw._getWatchedDir(dir);

    let throttler;
    let closer;

    const maxDepth = this.fsw.options.depth;

    if (
      (maxDepth == null || depth <= maxDepth) &&
      !this.fsw._symlinkPaths.has(realpath)
    ) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed) return;
      }

      closer = this._watchWithNodeFs(dir, (changedPath, stats) => {
        if (stats && stats.mtimeMs === 0) return; // removed

        this._handleRead(dir, false, wh, target, dir, depth, throttler);
      });
    }

    return closer;
  }

  /* ---------------------------------------------------------------------- */
  /*                         Add File/Dir/Glob to Watch                      */
  /* ---------------------------------------------------------------------- */

  async _addToNodeFs(pathArg, initialAdd, previousWh, depth, target) {
    const ready = this.fsw._emitReady;

    if (this.fsw._isIgnored(pathArg) || this.fsw.closed) {
      ready();
      return false;
    }

    const wh = this.fsw._getWatchHelpers(pathArg, depth);

    // Inherit glob filters when necessary
    if (!wh.hasGlob && previousWh) {
      wh.hasGlob = previousWh.hasGlob;
      wh.globFilter = previousWh.globFilter;
      wh.filterPath = entry => previousWh.filterPath(entry);
      wh.filterDir = entry => previousWh.filterDir(entry);
    }

    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed) return;

      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }

      const followSymlink =
        this.fsw.options.followSymlinks &&
        !pathArg.includes(STAR) &&
        !pathArg.includes(BRACE_START);

      let closer;

      if (stats.isDirectory()) {
        const absPath = path.resolve(pathArg);
        const resolvedPath = followSymlink
          ? await realpath(pathArg)
          : pathArg;

        if (this.fsw.closed) return;

        closer = await this._handleDir(
          wh.watchPath,
          stats,
          initialAdd,
          depth,
          target,
          wh,
          resolvedPath
        );

        if (this.fsw.closed) return;

        if (absPath !== resolvedPath && resolvedPath !== undefined) {
          this.fsw._symlinkPaths.set(absPath, resolvedPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = followSymlink
          ? await realpath(pathArg)
          : pathArg;

        if (this.fsw.closed) return;

        const parent = path.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);

        this.fsw._emit(EV_ADD, wh.watchPath, stats);

        closer = await this._handleDir(
          parent,
          stats,
          initialAdd,
          depth,
          pathArg,
          wh,
          targetPath
        );

        if (this.fsw.closed) return;

        if (targetPath !== undefined) {
          this.fsw._symlinkPaths.set(path.resolve(pathArg), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }

      ready();
      this.fsw._addPathCloser(pathArg, closer);

      return false;
    } catch (err) {
      if (this.fsw._handleError(err)) {
        ready();
        return pathArg;
      }
    }
  }
}

module.exports = NodeFsHandler;
