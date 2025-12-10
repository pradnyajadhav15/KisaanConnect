#!/usr/bin/env node

const fs = require('fs');
const cli = require('../lib/cli');
const nodemon = require('../lib');

// ✅ TS-safe import
const updateNotifier =
  require('simple-update-notifier').default ||
  require('simple-update-notifier');

const options = cli.parse(process.argv);

// Start nodemon
nodemon(options);

// Read package.json
const pkg = JSON.parse(
  fs.readFileSync(__dirname + '/../package.json', 'utf-8')
);

// Check for update safely
if (!pkg.version.startsWith('0.0.0') && options.noUpdateNotifier !== true) {
  updateNotifier({ pkg });
}
