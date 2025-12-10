const path = require('path');
const fs = require('fs');
const existsSync = fs.existsSync;
const utils = require('../utils');

module.exports = exec;
module.exports.expandScript = expandScript;

/**
 * Reads the cwd/package.json file and attempts to determine
 * the default script or exec command.
 *
 * @returns {{exec?: string|null, script?: string}|null}
 */
function execFromPackage() {
  try {
    const pkg = require(path.join(process.cwd(), 'package.json'));

    if (pkg.main !== undefined) {
      return { exec: null, script: pkg.main };
    }

    if (pkg.scripts && pkg.scripts.start) {
      return { exec: pkg.scripts.start };
    }
  } catch (e) {}

  return null;
}

/**
 * Replaces {{variable}} placeholders in strings.
 */
function replace(map, str) {
  const re = new RegExp(`{{(${Object.keys(map).join('|')})}}`, 'g');

  return str.replace(re, (all, key) => map[key] || all || '');
}

/**
 * Expands a script name to include extension if needed.
 */
function expandScript(script, ext = '.js') {
  if (script.includes(ext)) return script;

  if (existsSync(path.resolve(script))) {
    return script;
  }

  if (existsSync(path.resolve(script + ext))) {
    return script + ext;
  }

  return script;
}

/**
 * Discovers execution settings and builds the final options.
 *
 * @param {Object} nodemonOptions
 * @param {Object} execMap
 * @returns {Object}
 */
function exec(nodemonOptions, execMap = {}) {
  const options = utils.clone(nodemonOptions || {});
  let script;

  // Detect script from args if not explicitly set
  if (!options.script && (options.args || []).length) {
    script = expandScript(
      options.args[0],
      options.ext && '.' + (options.ext || 'js').split(',')[0]
    );

    if (script !== options.args[0]) {
      options.script = script;
      options.args.shift();
    }
  }

  // Load exec/script from package.json if missing
  if (!options.exec && !options.script) {
    const found = execFromPackage();

    if (found !== null) {
      if (found.exec) options.exec = found.exec;
      if (!options.script) options.script = found.script;

      if (Array.isArray(options.args) && options.scriptPosition === null) {
        options.scriptPosition = options.args.length;
      }
    }
  }

  const baseScript = path.basename(options.script || '');
  const scriptExt = path.extname(baseScript).slice(1);

  let extension = options.ext;

  if (extension === undefined) {
    const isJS = ['js', 'mjs', 'cjs'].includes(scriptExt);
    extension = isJS || !scriptExt ? 'js,mjs,cjs' : scriptExt;
    extension += ',json';
  }

  let execDefined = !!options.exec;

  // Map extension to custom exec
  if (!options.exec && execMap[scriptExt] !== undefined) {
    options.exec = execMap[scriptExt];
    execDefined = true;
  }

  options.execArgs = nodemonOptions.execArgs || [];

  if (Array.isArray(options.exec)) {
    options.execArgs = options.exec;
    options.exec = options.execArgs.shift();
  }

  // Default to node
  if (options.exec === undefined) {
    options.exec = 'node';
  } else {
    // Variable substitution
    const substitution = replace.bind(null, {
      filename: options.script,
      pwd: process.cwd(),
    });

    const newExec = substitution(options.exec);

    if (newExec !== options.exec && options.exec.includes('{{filename}}')) {
      options.script = null;
    }

    options.exec = newExec;

    const newExecArgs = options.execArgs.map(substitution);

    if (newExecArgs.join('') !== options.execArgs.join('')) {
      options.execArgs = newExecArgs;
      delete options.script;
    }
  }

  // Merge node arguments
  if (options.exec === 'node' && options.nodeArgs?.length) {
    options.execArgs = options.execArgs.concat(options.nodeArgs);
  }

  // CoffeeScript support
  if (
    !execDefined &&
    options.exec === 'node' &&
    scriptExt.includes('coffee')
  ) {
    options.exec = 'coffee';

    const leadingArgs = (options.args || []).splice(
      0,
      options.scriptPosition
    );

    options.execArgs = options.execArgs.concat(leadingArgs);
    options.scriptPosition = 0;

    if (options.execArgs.length > 0) {
      options.execArgs = ['--nodejs', options.execArgs.join(' ')];
    }
  }

  if (options.exec === 'coffee') {
    if (options.ext === undefined) {
      if (extension) extension += ',';
      extension += 'coffee,litcoffee';
    }

    if (utils.isWindows) {
      options.exec += '.cmd';
    }
  }

  // Normalize extensions (.js, pug → js,pug)
  extension = (extension.match(/[^,*\s]+/g) || [])
    .map((ext) => ext.replace(/^\./, ''))
    .join(',');

  options.ext = extension;

  if (options.script) {
    options.script = expandScript(
      options.script,
      extension && '.' + extension.split(',')[0]
    );
  }

  // Environment validation
  options.env = {};

  if ({}.toString.call(nodemonOptions.env) === '[object Object]') {
    options.env = utils.clone(nodemonOptions.env);
  } else if (nodemonOptions.env !== undefined) {
    throw new Error('nodemon env values must be an object: { PORT: 8000 }');
  }

  return options;
}
