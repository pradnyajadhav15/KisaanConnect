const ignoreRoot = require('ignore-by-default').directories();

// Default configuration options
const defaults = {
  restartable: 'rs',
  colours: true,

  execMap: {
    py: 'python',
    rb: 'ruby',
    ts: 'ts-node',
    // More can be added here (ensure cross-platform compatibility)
  },

  ignoreRoot: ignoreRoot.map(dir => `**/${dir}/**`),

  watch: ['*.*'],
  stdin: true,
  runOnChangeOnly: false,
  verbose: false,
  signal: 'SIGUSR2',

  // Includes both stdout and stderr output by default
  stdout: true,

  watchOptions: {},
};

// Disable ts-node when Node loader/import is present
const nodeOptions = process.env.NODE_OPTIONS || '';

if (/--(loader|import)\b/.test(nodeOptions)) {
  delete defaults.execMap.ts;
}

module.exports = defaults;
