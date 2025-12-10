/**
 * Check if a file path is a binary file.
 *
 * @example
 * ```ts
 * import isBinaryPath = require('is-binary-path');
 *
 * isBinaryPath('source/unicorn.png');
 * //=> true
 *
 * isBinaryPath('source/unicorn.txt');
 * //=> false
 * ```
 */
declare function isBinaryPath(filePath: string): boolean;

export = isBinaryPath;
