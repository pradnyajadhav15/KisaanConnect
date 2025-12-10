/**
 * Common logic for both Node.js and browser implementations of `debug()`.
 */

function setup(env) {
  // Initialize core debug function and attach helpers
  createDebug.debug = createDebug;
  createDebug.default = createDebug;
  createDebug.coerce = coerce;
  createDebug.disable = disable;
  createDebug.enable = enable;
  createDebug.enabled = enabled;
  createDebug.humanize = require('ms');
  createDebug.destroy = destroy;

  // Merge environment-specific properties
  Object.keys(env).forEach(key => {
    createDebug[key] = env[key];
  });

  // State for active debug namespaces
  createDebug.names = [];
  createDebug.skips = [];

  // Formatter map for %x style placeholders
  createDebug.formatters = {};

  /**
   * Select a color for a debug namespace
   */
  function selectColor(namespace) {
    let hash = 0;
    for (let i = 0; i < namespace.length; i++) {
      hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
  }
  createDebug.selectColor = selectColor;

  /**
   * Create a debug instance for a given namespace
   */
  function createDebug(namespace) {
    let prevTime;
    let enableOverride = null;
    let namespacesCache;
    let enabledCache;

    function debug(...args) {
      if (!debug.enabled) return;

      const self = debug;
      const curr = Date.now();
      const ms = curr - (prevTime || curr);
      self.diff = ms;
      self.prev = prevTime;
      self.curr = curr;
      prevTime = curr;

      args[0] = createDebug.coerce(args[0]);

      if (typeof args[0] !== 'string') args.unshift('%O');

      // Apply formatters
      let index = 0;
      args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
        if (match === '%%') return '%';
        index++;
        const formatter = createDebug.formatters[format];
        if (typeof formatter === 'function') {
          const val = args[index];
          match = formatter.call(self, val);
          args.splice(index, 1);
          index--;
        }
        return match;
      });

      // Env-specific formatting (colors, etc.)
      createDebug.formatArgs.call(self, args);

      const logFn = self.log || createDebug.log;
      logFn.apply(self, args);
    }

    // Debug instance properties
    debug.namespace = namespace;
    debug.useColors = createDebug.useColors();
    debug.color = createDebug.selectColor(namespace);
    debug.extend = extend;
    debug.destroy = createDebug.destroy;

    Object.defineProperty(debug, 'enabled', {
      enumerable: true,
      configurable: false,
      get: () => {
        if (enableOverride !== null) return enableOverride;
        if (namespacesCache !== createDebug.namespaces) {
          namespacesCache = createDebug.namespaces;
          enabledCache = createDebug.enabled(namespace);
        }
        return enabledCache;
      },
      set: v => { enableOverride = v; }
    });

    if (typeof createDebug.init === 'function') createDebug.init(debug);

    return debug;
  }

  /**
   * Extend a debug namespace
   */
  function extend(namespace, delimiter) {
    const newDebug = createDebug(
      this.namespace + (delimiter === undefined ? ':' : delimiter) + namespace
    );
    newDebug.log = this.log;
    return newDebug;
  }

  /**
   * Enable debug namespaces
   */
  function enable(namespaces) {
    createDebug.save(namespaces);
    createDebug.namespaces = namespaces;

    createDebug.names = [];
    createDebug.skips = [];

    const split = (typeof namespaces === 'string' ? namespaces : '')
      .trim()
      .replace(' ', ',')
      .split(',')
      .filter(Boolean);

    for (const ns of split) {
      if (ns[0] === '-') createDebug.skips.push(ns.slice(1));
      else createDebug.names.push(ns);
    }
  }

  /**
   * Check if `name` matches a namespace template with wildcards
   */
  function matchesTemplate(search, template) {
    let searchIndex = 0;
    let templateIndex = 0;
    let starIndex = -1;
    let matchIndex = 0;

    while (searchIndex < search.length) {
      if (
        templateIndex < template.length &&
        (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')
      ) {
        if (template[templateIndex] === '*') {
          starIndex = templateIndex;
          matchIndex = searchIndex;
          templateIndex++;
        } else {
          searchIndex++;
          templateIndex++;
        }
      } else if (starIndex !== -1) {
        templateIndex = starIndex + 1;
        matchIndex++;
        searchIndex = matchIndex;
      } else return false;
    }

    while (templateIndex < template.length && template[templateIndex] === '*') templateIndex++;

    return templateIndex === template.length;
  }

  /**
   * Disable all debug output
   */
  function disable() {
    const namespaces = [
      ...createDebug.names,
      ...createDebug.skips.map(ns => '-' + ns)
    ].join(',');
    createDebug.enable('');
    return namespaces;
  }

  /**
   * Check if a namespace is enabled
   */
  function enabled(name) {
    for (const skip of createDebug.skips) {
      if (matchesTemplate(name, skip)) return false;
    }
    for (const ns of createDebug.names) {
      if (matchesTemplate(name, ns)) return true;
    }
    return false;
  }

  /**
   * Coerce a value (Errors => stack/message)
   */
  function coerce(val) {
    if (val instanceof Error) return val.stack || val.message;
    return val;
  }

  /**
   * Temporary destroy stub
   */
  function destroy() {
    console.warn(
      'Instance method `debug.destroy()` is deprecated and no longer does anything. ' +
      'It will be removed in the next major version of `debug`.'
    );
  }

  // Load saved namespaces
  createDebug.enable(createDebug.load());

  return createDebug;
}

module.exports = setup;
