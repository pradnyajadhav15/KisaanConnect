const path = require('path');
const utils = require('./utils');
const merge = utils.merge;
const bus = utils.bus;
const { spawn } = require('child_process');

/**
 * Spawns a child process for a command, with environment and I/O configured.
 * @param {string|string[]} command - The command or array of command parts to run.
 * @param {object} config - nodemon configuration object.
 * @param {Array} eventArgs - Array of arguments related to the event, e.g., filename.
 */
module.exports = function spawnCommand(command, config, eventArgs) {
  // Default stdio is pipes; can override with actual stdout/stderr
  let stdio = ['pipe', 'pipe', 'pipe'];
  if (config.options.stdout) {
    stdio = ['pipe', process.stdout, process.stderr];
  }

  // Merge environment variables with FILENAME
  const env = merge(process.env, { FILENAME: eventArgs[0] });

  // Shell defaults
  let sh = 'sh';
  let shFlag = '-c';

  const spawnOptions = {
    env: merge(config.options.execOptions.env, env),
    stdio,
  };

  // Ensure command is an array
  if (!Array.isArray(command)) command = [command];

  if (utils.isWindows) {
    // Normalize forward slashes on Windows (only for the executable)
    command = command.map(executable => {
      if (!executable.includes('/')) return executable;

      return executable.split(' ').map((part, i) => i === 0 ? path.normalize(part) : part).join(' ');
    });

    // Use cmd for Windows
    sh = process.env.comspec || 'cmd';
    shFlag = '/d /s /c';

    spawnOptions.windowsVerbatimArguments = true;
    spawnOptions.windowsHide = true;
  }

  const args = command.join(' ');
  const child = spawn(sh, [shFlag, args], spawnOptions);

  // Bind stdout/stderr to bus if required
  if (config.required) {
    const emit = {
      stdout: data => bus.emit('stdout', data),
      stderr: data => bus.emit('stderr', data),
    };

    if (config.options.stdout) {
      child.on('stdout', emit.stdout).on('stderr', emit.stderr);
    } else {
      child.stdout.on('data', emit.stdout);
      child.stderr.on('data', emit.stderr);

      // Save streams for downstream consumption
      bus.stdout = child.stdout;
      bus.stderr = child.stderr;
    }
  }
};
