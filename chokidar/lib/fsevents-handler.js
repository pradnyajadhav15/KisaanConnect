'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

//
// Attempt to load fsevents (macOS file system events)
//
let fsevents;
try {
  fsevents = require('fsevents');
} catch (err) {
  if (process.env.CHOKIDAR_PRINT_FSEVENTS_REQUIRE_ERROR) {
    console.error(err);
  }
}

// Node 8.x compatibility check (older minors unsupported)
if (fsevents) {
  const match = process.version.match(/v(\d+)\.(\d+)/);
  if (match) {
    const [major, minor] = match.slice(1).map(Number);
    if (major === 8 && minor < 16) {
      fsevents = undefined;
    }
  }
}

//
// Constants
//
const {
  EV_ADD,
  EV_CHANGE,
  EV_ADD_DIR,
  EV_UNLINK,
  EV_ERROR,
  STR_DATA,
  STR_END,
  FSEVENT_CREATED,
  FSEVENT_MODIFIED,
  FSEVENT_DELETED,
  FSEVENT_MOVED,
  FSEVENT_UNKNOWN,
  FSEVENT_FLAG_MUST_SCAN_SUBDIRS,
  FSEVENT_TYPE_FILE,
  FSEVENT_TYPE_DIRECTORY,
  FSEVENT_TYPE_SYMLINK,
  ROOT_GLOBSTAR,
  DIR_SUFFIX,
  DOT_SLASH,
  FUNCTION_TYPE,
  EMPTY_FN,
  IDENTITY_FN
} = require('./constants');

//
// Simple helpers
//
const stat = promisify(fs.stat);
const lstat = promisify(fs.lstat);
const realpath = promisify(fs.realpath);
const statMethods = { stat, lstat };

const Depth = (n) => (isNaN(n) ? {} : { depth: n });

// When fsevents instances grow too many, group them into parent watchers
const CONSOLIDATE_THRESHOLD = 10;

// Flags known to be incorrect from fsevents
const WRONG_EVENT_FLAGS = new Set([
  69888, 70400, 71424, 72704, 73472,
  131328, 131840, 262912
]);

//
// Store active watchers by their root paths
//
const FSEventsWatchers = new Map();


//
// Create an fsevents watcher instance
//
function createFSEventsInstance(watchPath, callback) {
  return { stop: fsevents.watch(watchPath, callback) };
}

//
// Whether we have too many separate watchers sharing a parent path
//
function couldConsolidate(parentPath) {
  let count = 0;
  for (const watchedPath of FSEventsWatchers.keys()) {
    if (watchedPath.startsWith(parentPath)) {
      if (++count >= CONSOLIDATE_THRESHOLD) return true;
    }
  }
  return false;
}

//
// Check if fsevents can be used at this moment
//
function canUse() {
  return fsevents && FSEventsWatchers.size < 128;
}

//
// Recursively count directory depth from root to path
//
function calcDepth(target, root) {
  let depth = 0;
  while (!target.indexOf(root) && (target = path.dirname(target)) !== root) {
    depth++;
  }
  return depth;
}

//
// Compare fsevents info to fs.stat results
//
function sameTypes(info, stats) {
  return (
    (info.type === FSEVENT_TYPE_DIRECTORY && stats.isDirectory()) ||
    (info.type === FSEVENT_TYPE_SYMLINK && stats.isSymbolicLink()) ||
    (info.type === FSEVENT_TYPE_FILE && stats.isFile())
  );
}

//
// Attach listener to fsevents watcher (or reuse existing)
//
// Handles:
//   • symlinks
//   • path filtering
//   • parent consolidation
//
function setFSEventsListener(originalPath, realPath, listener, rawEmitter) {
  // Watch directories, not individual files
  let watchPath = path.extname(realPath)
    ? path.dirname(realPath)
    : realPath;

  const parent = path.dirname(watchPath);
  let container = FSEventsWatchers.get(watchPath);

  // Consolidate into parent watcher when too many subpaths exist
  if (couldConsolidate(parent)) {
    watchPath = parent;
  }

  // Map real paths to symlink paths if needed
  const resolved = path.resolve(originalPath);
  const hasSymlink = resolved !== realPath;

  const filteredListener = (fullPath, flags, info) => {
    if (hasSymlink) {
      fullPath = fullPath.replace(realPath, resolved);
    }
    if (fullPath === resolved || fullPath.startsWith(resolved + path.sep)) {
      listener(fullPath, flags, info);
    }
  };

  //
  // Check if a parent path is already watched
  //
  let usingParent = false;
  for (const existing of FSEventsWatchers.keys()) {
    if (realPath.startsWith(path.resolve(existing) + path.sep)) {
      watchPath = existing;
      container = FSEventsWatchers.get(existing);
      usingParent = true;
      break;
    }
  }

  //
  // Add listener to existing watcher
  //
  if (container || usingParent) {
    container.listeners.add(filteredListener);
  } else {
    //
    // Create a new fsevents watcher
    //
    container = {
      listeners: new Set([filteredListener]),
      rawEmitter,
      watcher: createFSEventsInstance(watchPath, (fullPath, flags) => {
        if (!container.listeners.size) return;
        if (flags & FSEVENT_FLAG_MUST_SCAN_SUBDIRS) return;

        const info = fsevents.getInfo(fullPath, flags);

        container.listeners.forEach((fn) => fn(fullPath, flags, info));
        container.rawEmitter(info.event, fullPath, info);
      })
    };

    FSEventsWatchers.set(watchPath, container);
  }

  //
  // Remove listener and possibly stop watcher
  //
  return async () => {
    container.listeners.delete(filteredListener);

    if (container.listeners.size === 0) {
      FSEventsWatchers.delete(watchPath);

      if (container.watcher) {
        await container.watcher.stop();
        container.rawEmitter = undefined;
        container.watcher = undefined;
        Object.freeze(container);
      }
    }
  };
}

//
// MAIN CLASS: FsEventsHandler
// Handles:
//   • fsevents directory watching
//   • symlink resolution
//   • add/change/delete detection
//
class FsEventsHandler {

  constructor(fsw) {
    this.fsw = fsw;
  }

  //
  // Ignore filters
  //
  checkIgnored(pathName, stats) {
    const ignoredPaths = this.fsw._ignoredPaths;

    if (this.fsw._isIgnored(pathName, stats)) {
      ignoredPaths.add(pathName);
      if (stats?.isDirectory()) {
        ignoredPaths.add(pathName + ROOT_GLOBSTAR);
      }
      return true;
    }

    ignoredPaths.delete(pathName);
    ignoredPaths.delete(pathName + ROOT_GLOBSTAR);
    return false;
  }

  //
  // Add or change event wrapper
  //
  addOrChange(pathName, fullPath, realPath, parent, watchedDir, item, info, opts) {
    const event = watchedDir.has(item) ? EV_CHANGE : EV_ADD;
    this.handleEvent(event, pathName, fullPath, realPath, parent, watchedDir, item, info, opts);
  }

  //
  // Check if file exists, decide between add/change/unlink
  //
  async checkExists(pathName, fullPath, realPath, parent, watchedDir, item, info, opts) {
    try {
      const stats = await stat(pathName);
      if (this.fsw.closed) return;

      if (sameTypes(info, stats)) {
        this.addOrChange(pathName, fullPath, realPath, parent, watchedDir, item, info, opts);
      } else {
        this.handleEvent(EV_UNLINK, pathName, fullPath, realPath, parent, watchedDir, item, info, opts);
      }

    } catch (err) {
      if (err.code === 'EACCES') {
        this.addOrChange(pathName, fullPath, realPath, parent, watchedDir, item, info, opts);
      } else {
        this.handleEvent(EV_UNLINK, pathName, fullPath, realPath, parent, watchedDir, item, info, opts);
      }
    }
  }

  //
  // Core event processing (add, change, unlink)
  //
  handleEvent(event, pathName, fullPath, realPath, parent, watchedDir, item, info, opts) {
    if (this.fsw.closed || this.checkIgnored(pathName)) return;

    const isDir = info.type === FSEVENT_TYPE_DIRECTORY;

    if (event === EV_UNLINK) {
      if (isDir || watchedDir.has(item)) {
        this.fsw._remove(parent, item, isDir);
      }
    } else {
      if (event === EV_ADD) {
        if (isDir) {
          this.fsw._getWatchedDir(pathName);
        }

        if (info.type === FSEVENT_TYPE_SYMLINK && opts.followSymlinks) {
          const depth = (opts.depth === undefined)
            ? undefined
            : calcDepth(fullPath, realPath) + 1;

          return this._addToFsEvents(pathName, false, true, depth);
        }

        this.fsw._getWatchedDir(parent).add(item);
      }

      const eventName = isDir ? event + DIR_SUFFIX : event;
      this.fsw._emit(eventName, pathName);

      if (eventName === EV_ADD_DIR) {
        this._addToFsEvents(pathName, false, true);
      }
    }
  }

  //
  // Attach fsevents watcher for directories / symlinks
  //
  _watchWithFsEvents(watchPath, realPath, transformPath, globFilter) {
    if (this.fsw.closed || this.fsw._isIgnored(watchPath)) return;

    const opts = this.fsw.options;

    const listener = async (fullPath, flags, info) => {
      if (this.fsw.closed) return;

      // Depth limit
      if (opts.depth !== undefined && calcDepth(fullPath, realPath) > opts.depth) return;

      const relative = path.join(
        watchPath,
        path.relative(watchPath, fullPath)
      );

      const finalPath = transformPath(relative);

      if (globFilter && !globFilter(finalPath)) return;

      const parent = path.dirname(finalPath);
      const item = path.basename(finalPath);

      const watchedDir = this.fsw._getWatchedDir(
        info.type === FSEVENT_TYPE_DIRECTORY ? finalPath : parent
      );

      //
      // Fix bad events
      //
      if (WRONG_EVENT_FLAGS.has(flags) || info.event === FSEVENT_UNKNOWN) {
        if (typeof opts.ignored === FUNCTION_TYPE) {
          let stats;
          try { stats = await stat(finalPath); } catch {}
          if (this.fsw.closed) return;

          if (this.checkIgnored(finalPath, stats)) return;

          if (sameTypes(info, stats)) {
            this.addOrChange(finalPath, fullPath, realPath, parent, watchedDir, item, info, opts);
          } else {
            this.handleEvent(EV_UNLINK, finalPath, fullPath, realPath, parent, watchedDir, item, info, opts);
          }
        } else {
          this.checkExists(finalPath, fullPath, realPath, parent, watchedDir, item, info, opts);
        }
        return;
      }

      //
      // Normal events
      //
      switch (info.event) {
        case FSEVENT_CREATED:
        case FSEVENT_MODIFIED:
          return this.addOrChange(finalPath, fullPath, realPath, parent, watchedDir, item, info, opts);

        case FSEVENT_DELETED:
        case FSEVENT_MOVED:
          return this.checkExists(finalPath, fullPath, realPath, parent, watchedDir, item, info, opts);
      }
    };

    const stop = setFSEventsListener(
      watchPath,
      realPath,
      listener,
      this.fsw._emitRaw
    );

    this.fsw._emitReady();
    return stop;
  }

  //
  // Handle found symlink through fsevents
  //
  async _handleFsEventsSymlink(linkPath, fullPath, transform, depth) {
    if (this.fsw.closed || this.fsw._symlinkPaths.has(fullPath)) return;

    this.fsw._symlinkPaths.set(fullPath, true);
    this.fsw._incrReadyCount();

    try {
      const target = await realpath(linkPath);
      if (this.fsw.closed) return;

      if (this.fsw._isIgnored(target)) {
        return this.fsw._emitReady();
      }

      this.fsw._incrReadyCount();

      // Wrap transform so emitted paths use the symlink path instead of real path
      const pathTransform = (p) => {
        if (target && target !== DOT_SLASH) {
          return transform(p.replace(target, linkPath));
        }
        return transform(p !== DOT_SLASH ? path.join(linkPath, p) : linkPath);
      };

      this._addToFsEvents(target || linkPath, pathTransform, false, depth);

    } catch (err) {
      if (this.fsw._handleError(err)) {
        return this.fsw._emitReady();
      }
    }
  }

  //
  // Emit add/addDir events and track directory membership
  //
  emitAdd(newPath, stats, processPath, opts, forceAdd) {
    const finalPath = processPath(newPath);
    const isDir = stats.isDirectory();

    const parentDir = this.fsw._getWatchedDir(path.dirname(finalPath));
    const base = path.basename(finalPath);

    if (isDir) {
      this.fsw._getWatchedDir(finalPath); // ensure empty dir tracked
    }
    if (parentDir.has(base)) return;

    parentDir.add(base);

    if (!opts.ignoreInitial || forceAdd) {
      this.fsw._emit(isDir ? EV_ADD_DIR : EV_ADD, finalPath, stats);
    }
  }

  //
  // Set up fsevents watcher after initial scan
  //
  initWatch(realPath, originalPath, wh, processPath) {
    if (this.fsw.closed) return;

    const closer = this._watchWithFsEvents(
      wh.watchPath,
      path.resolve(realPath || wh.watchPath),
      processPath,
      wh.globFilter
    );

    this.fsw._addPathCloser(originalPath, closer);
  }

  //
  // Add a path to fsevents monitoring (directories or symlinks)
  //
  async _addToFsEvents(targetPath, transform, forceAdd, depth) {
    if (this.fsw.closed) return;

    const opts = this.fsw.options;
    const processPath = typeof transform === FUNCTION_TYPE ? transform : IDENTITY_FN;

    const wh = this.fsw._getWatchHelpers(targetPath);

    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);

      if (this.fsw.closed) return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) throw null;

      if (stats.isDirectory()) {
        //
        // Directory case
        //
        if (!wh.globFilter) {
          this.emitAdd(processPath(targetPath), stats, processPath, opts, forceAdd);
        }

        if (depth && depth > opts.depth) return;

        //
        // Scan directory contents
        //
        this.fsw._readdirp(
          wh.watchPath,
          Object.assign(
            {
              fileFilter: (e) => wh.filterPath(e),
              directoryFilter: (e) => wh.filterDir(e)
            },
            Depth(opts.depth - (depth || 0))
          )
        )
          .on(STR_DATA, (entry) => {
            if (this.fsw.closed) return;

            if (entry.stats.isDirectory() && !wh.filterPath(entry)) return;

            const childPath = path.join(wh.watchPath, entry.path);

            if (wh.followSymlinks && entry.stats.isSymbolicLink()) {
              const childDepth = opts.depth === undefined
                ? undefined
                : calcDepth(childPath, path.resolve(wh.watchPath)) + 1;

              this._handleFsEventsSymlink(childPath, entry.fullPath, processPath, childDepth);
            } else {
              this.emitAdd(childPath, entry.stats, processPath, opts, forceAdd);
            }
          })
          .on(EV_ERROR, EMPTY_FN)
          .on(STR_END, () => this.fsw._emitReady());

      } else {
        //
        // Single file case
        //
        this.emitAdd(wh.watchPath, stats, processPath, opts, forceAdd);
        this.fsw._emitReady();
      }

    } catch (err) {
      //
      // Error or ignored path
      //
      if (!err || this.fsw._handleError(err)) {
        this.fsw._emitReady();
        this.fsw._emitReady();
      }
    }

    //
    // Attach persistent watcher
    //
    if (opts.persistent && forceAdd !== true) {
      if (typeof transform === FUNCTION_TYPE) {
        this.initWatch(undefined, targetPath, wh, processPath);
      } else {
        let resolved;
        try { resolved = await realpath(wh.watchPath); } catch {}
        this.initWatch(resolved, targetPath, wh, processPath);
      }
    }
  }
}

module.exports = FsEventsHandler;
module.exports.canUse = canUse;
