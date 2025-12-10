'use strict';

/**
 * Returns a list of common directories that are usually ignored
 * in projects for version control, coverage, or caching purposes.
 *
 * @returns {string[]} Array of directory names.
 */
exports.directories = function () {
  return [
    '.git',           // Git repository files: https://git-scm.com/
    '.nyc_output',    // Temporary coverage data: https://github.com/bcoe/nyc
    '.sass-cache',    // Cache folder for node-sass: https://github.com/sass/node-sass
    'bower_components', // Bower package installation folder: http://bower.io/
    'coverage',       // Standard directory for code coverage reports: https://github.com/gotwarlost/istanbul
    'node_modules'    // Node modules installation folder: https://nodejs.org/
  ];
};
