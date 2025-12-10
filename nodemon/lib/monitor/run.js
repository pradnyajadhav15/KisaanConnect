const { statSync, execSync } = require('fs');
const childProcess = require('child_process');
const { spawn, fork, exec } = childProcess;
const path = require('path');
const os = require('os');

const debug = require('debug')('nodemon:run');
const utils = require('../utils');
const bus = utils.bus;
const watch = require('./watch').watch;
const config = require('../config');
const signals = require('./signals');
const undefsafe = require('undefsafe');
const psTree = require('pstree.remy');

let child = null;
let killedAfterChange = false;
let restart = null;

const noop = () => {};
const osReleaseMajor = parseInt(os.release().split('.')[0], 10);

/**
 * Main run function to start or restart the monitored process.
 */
function run(options) {
  const cmd = config.command.raw;
  restart = run.bind(this, options); // allow restart
  run.restart = restart;
  run.options = options;

  const shouldRunCmd = !options.runOnChangeOnly || config.lastStarted !== 0;

  if (shouldRunCmd) {
    utils.log.status(`starting \`${config.command.string}\``);
  } else {
    debug('start watch only on: %s', config.options.watch);
    if (config.options.watch !== false) watch();
    return;
  }

  config.lastStarted = Date.now();

  // Setup stdio options
  let stdio = ['pipe', 'pipe', 'pipe'];
  if (config.options.stdout) stdio = ['pipe', process.stdout, process.stderr];
  if (config.options.stdin === false) stdio = [process.stdin, process.stdout, process.stderr];

  // Determine shell options
  let sh = 'sh';
  let shFlag = '-c';
  const binPath = path.join(process.cwd(), 'node_modules', '.bin');

  const spawnOptions = {
    env: {
      ...options.execOptions.env,
      ...process.env,
      PATH: `${binPath}${path.delimiter}${undefsafe(options, '.execOptions.env.PATH') || process.env.PATH}`,
    },
    stdio,
  };

  let executable = cmd.executable;

  // Windows adjustments
  if (utils.isWindows) {
    if (executable.includes('/')) {
      executable = executable
        .split(' ')
        .map((e, i) => (i === 0 ? path.normalize(e) : e))
        .join(' ');
    }
    sh = process.env.comspec || 'cmd';
    shFlag = '/d /s /c';
    spawnOptions.windowsVerbatimArguments = true;
    spawnOptions.windowsHide = true;
  }

  const args = shouldRunCmd ? utils.stringify(executable, cmd.args) : ':';
  const spawnArgs = [sh, [shFlag, args], spawnOptions];

  const firstArg = cmd.args[0] || '';
  let inBinPath = false;

  try {
    inBinPath = statSync(path.join(binPath, executable)).isFile();
  } catch (e) {}

  const hasStdio = utils.satisfies('>= 6.4.0 || < 5');

  // Decide whether to fork instead of spawn
  const shouldFork =
    !config.options.spawn &&
    !inBinPath &&
    !firstArg.startsWith('-') &&
    firstArg !== 'inspect' &&
    executable === 'node' &&
    utils.version.major > 4;

  if (shouldFork) {
    const forkArgs = cmd.args.slice(1);
    const forkEnv = { ...options.execOptions.env, ...process.env };
    stdio.push('ipc');

    const forkOptions = { env: forkEnv, stdio, silent: !hasStdio };
    if (utils.isWindows) forkOptions.windowsHide = true;

    child = fork(options.execOptions.script, forkArgs, forkOptions);
    utils.log.detail('forking');
    debug('fork', sh, shFlag, args);
  } else {
    utils.log.detail('spawning');
    child = spawn(...spawnArgs);
    debug('spawn', sh, shFlag, args);
  }

  setupBusEvents(child, shouldFork);
  setupStdin(options, hasStdio);
  debug('watch on: %s', config.options.watch);
  if (config.options.watch !== false) watch();
}

/**
 * Set up bus events like stdout, stderr, and exit handling.
 */
function setupBusEvents(childProcess, forked) {
  if (!config.required) return;

  const emit = {
    stdout: data => bus.emit('stdout', data),
    stderr: data => bus.emit('stderr', data),
  };

  if (config.options.stdout) {
    childProcess.on('stdout', emit.stdout).on('stderr', emit.stderr);
  } else {
    childProcess.stdout.on('data', emit.stdout);
    childProcess.stderr.on('data', emit.stderr);
    bus.stdout = childProcess.stdout;
    bus.stderr = childProcess.stderr;
  }

  if (forked) {
    childProcess.on('message', (message, sendHandle) => bus.emit('message', message, sendHandle));
  }

  bus.emit('start');
  utils.log.detail(`child pid: ${childProcess.pid}`);

  // Handle errors
  childProcess.on('error', error => {
    bus.emit('error', error);
    if (error.code === 'ENOENT') {
      utils.log.error(`unable to run executable: "${config.command.raw.executable}"`);
      process.exit(1);
    } else {
      utils.log.error(`failed to start child process: ${error.code}`);
      throw error;
    }
  });

  // Handle exit
  childProcess.on('exit', handleChildExit);
}

/**
 * Handle stdin piping
 */
function setupStdin(options, hasStdio) {
  if (!options.stdin) return;

  process.stdin.resume();

  if (hasStdio) {
    child.stdin.on('error', noop);
    process.stdin.pipe(child.stdin);
  } else if (child.stdout) {
    child.stdout.pipe(process.stdout);
  } else {
    utils.log.error(`unsupported Node version: ${process.version}`);
    utils.log.error('Consider upgrading to LTS');
  }

  bus.once('exit', () => {
    if (child && process.stdin.unpipe) process.stdin.unpipe(child.stdin);
  });
}

/**
 * Kill the child process and its subtree.
 */
function killProcess(childProcess, signal, callback = noop) {
  if (utils.isWindows) return killWindows(childProcess, signal, callback);
  return killUnix(childProcess, signal, callback);
}

function killWindows(childProcess, signal, callback) {
  const taskKill = () => {
    try {
      exec(`taskkill /pid ${childProcess.pid} /T /F`);
    } catch (e) {
      utils.log.error('Could not shutdown subprocess cleanly');
    }
  };

  if (['SIGKILL', 'SIGUSR1', 'SIGUSR2'].includes(signal) || osReleaseMajor < 10) {
    debug('terminating process group by force: %s', childProcess.pid);
    taskKill();
    return callback();
  }

  try {
    const resultBuffer = execSync(`wmic process where (ParentProcessId=${childProcess.pid}) get ProcessId 2> nul`);
    const result = resultBuffer.toString().match(/^[0-9]+/m);
    const processId = Array.isArray(result) ? result[0] : childProcess.pid;

    const windowsKill = path.normalize(`${__dirname}/../../bin/windows-kill.exe`);
    execSync(`start "windows-kill" /min /wait "${windowsKill}" -SIGINT ${processId}`);
  } catch (e) {
    taskKill();
  }

  callback();
}

function killUnix(childProcess, signal, callback) {
  let sig = signal.replace('SIG', '');
  psTree(childProcess.pid, (err, pids) => {
    if (!psTree.hasPS) sig = signals[signal];
    debug('sending kill signal to ' + pids.join(', '));

    childProcess.kill(signal);
    pids.sort().forEach(pid => exec(`kill -${sig} ${pid}`, noop));

    waitForSubProcesses(childProcess.pid, () => exec(`kill -${sig} ${childProcess.pid}`, callback));
  });
}

/**
 * Kill and optionally restart
 */
run.kill = function (noRestart, callback = noop) {
  if (typeof noRestart === 'function') {
    callback = noRestart;
    noRestart = false;
  }

  if (!child) {
    if (!noRestart) {
      bus.once('start', callback);
      run.restart();
    } else {
      callback();
    }
    return;
  }

  if (run.options.stdin) process.stdin.unpipe(child.stdin);
  if (!noRestart) killedAfterChange = true;

  const oldPid = child.pid;
  kill(child, config.signal, () => {
    if (child && run.options.stdin && child.stdin && oldPid === child.pid) child.stdin.end();
    callback();
  });
};

run.restart = noop;

/**
 * Wait for sub-processes to finish
 */
function waitForSubProcesses(pid, callback) {
  debug('checking ps tree for pids of ' + pid);
  psTree(pid, (err, pids) => {
    if (!pids.length) return callback();
    utils.log.status(`still waiting for ${pids.length} subprocess${pids.length > 1 ? 'es' : ''}...`);
    setTimeout(() => waitForSubProcesses(pid, callback), 1000);
  });
}

// Event listeners
bus.on('quit', handleQuit);
bus.on('restart', () => run.kill());

// Clean up on process exit
process.on('exit', () => {
  utils.log.detail('exiting');
  if (child) child.kill();
});

if (!utils.isWindows) {
  bus.once('boot', () => {
    process.once('SIGINT', () => bus.emit('quit', 130));
    process.once('SIGTERM', () => {
      bus.emit('quit', 143);
      if (child) child.kill('SIGTERM');
    });
  });
}

module.exports = run;
