/**
 * Detect environment and export the appropriate implementation:
 * - Electron renderer or NW.js → treat as browser
 * - Otherwise → Node.js
 */

const isBrowserLike =
  typeof process === 'undefined' ||          // No process object → browser
  process.type === 'renderer' ||             // Electron renderer process
  process.browser === true ||                // Explicit browser flag
  process.__nwjs;                            // NW.js environment

module.exports = isBrowserLike
  ? require('./browser.js')
  : require('./node.js');
