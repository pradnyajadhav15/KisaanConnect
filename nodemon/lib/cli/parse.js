const fs = require('fs');
const path = require('path');

const existsSync = fs.existsSync || path.existsSync;

module.exports = parse;

/**
 * Parses process.argv and returns nodemon options.
 *
 * @param {string[] | string} argv
 * @returns {Object}
 */
function parse(argv) {
  if (typeof argv === 'string') {
    argv = argv.split(' ');
  }

  const eat = (index, args) => {
    if (index <= args.length) {
      return args.splice(index + 1, 1).pop();
    }
  };

  const args = argv.slice(2);
  let script = null;
  const nodemonOptions = { scriptPosition: null };

  const nodemonOpt = nodemonOption.bind(null, nodemonOptions);
  let lookForArgs = true;

  for (let i = 0; i < args.length; i++) {
    // Detect script file
    if (!script && (args[i] === '.' || existsSync(args[i]))) {
      script = args.splice(i, 1).pop();
      nodemonOptions.scriptPosition = i;
      i--;
      continue;
    }

    if (lookForArgs) {
      // Stop parsing nodemon args after `--`
      if (args[i] === '--') {
        args.splice(i, 1);
        nodemonOptions.scriptPosition = i;
        i--;
        lookForArgs = false;
        continue;
      }

      if (nodemonOpt(args[i], eat.bind(null, i, args)) !== false) {
        args.splice(i, 1);
        i--;
      }
    }
  }

  nodemonOptions.script = script;
  nodemonOptions.args = args;

  return nodemonOptions;
}

/**
 * Matches CLI flags and updates nodemon options.
 *
 * @param {Object} options
 * @param {string} arg
 * @param {Function} eatNext
 * @returns {boolean}
 */
function nodemonOption(options, arg, eatNext) {
  if (arg === '--help' || arg === '-h' || arg === '-?') {
    const help = eatNext();
    options.help = help || true;
  } else if (arg === '--version' || arg === '-v') {
    options.version = true;
  } else if (arg === '--no-update-notifier') {
    options.noUpdateNotifier = true;
  } else if (arg === '--spawn') {
    options.spawn = true;
  } else if (arg === '--dump') {
    options.dump = true;
  } else if (arg === '--verbose' || arg === '-V') {
    options.verbose = true;
  } else if (arg === '--legacy-watch' || arg === '-L') {
    options.legacyWatch = true;
  } else if (arg === '--polling-interval' || arg === '-P') {
    options.pollingInterval = parseInt(eatNext(), 10);
  } else if (arg === '--js') {
    options.js = true;
  } else if (arg === '--quiet' || arg === '-q') {
    options.quiet = true;
  } else if (arg === '--config') {
    options.configFile = eatNext();
  } else if (arg === '--watch' || arg === '-w') {
    if (!options.watch) options.watch = [];
    options.watch.push(eatNext());
  } else if (arg === '--ignore' || arg === '-i') {
    if (!options.ignore) options.ignore = [];
    options.ignore.push(eatNext());
  } else if (arg === '--exitcrash') {
    options.exitCrash = true;
  } else if (arg === '--delay' || arg === '-d') {
    options.delay = parseDelay(eatNext());
  } else if (arg === '--exec' || arg === '-x') {
    options.exec = eatNext();
  } else if (arg === '--no-stdin' || arg === '-I') {
    options.stdin = false;
  } else if (arg === '--on-change-only' || arg === '-C') {
    options.runOnChangeOnly = true;
  } else if (arg === '--ext' || arg === '-e') {
    options.ext = eatNext();
  } else if (arg === '--no-colours' || arg === '--no-colors') {
    options.colours = false;
  } else if (arg === '--signal' || arg === '-s') {
    options.signal = eatNext();
  } else if (arg === '--cwd') {
    options.cwd = eatNext();
    process.chdir(path.resolve(options.cwd));
  } else {
    return false; // Not a nodemon argument
  }
}

/**
 * Parses delay values into milliseconds.
 *
 * @param {string} value
 * @returns {number}
 */
function parseDelay(value) {
  const millisPerSecond = 1000;
  let millis = 0;

  if (/^\d*ms$/.test(value)) {
    millis = parseInt(value, 10);
  } else {
    millis = parseFloat(value) * millisPerSecond;
  }

  return isNaN(millis) ? 0 : millis;
}
