module.exports = command;

/**
 * Builds the executable shell command with user script and arguments.
 *
 * @param {Object} settings
 * @returns {{ executable: string, args: string[] }}
 */
function command(settings) {
  const options = settings.execOptions;
  const executable = options.exec;
  const args = [];

  // Add execution arguments (e.g., --debug)
  if (options.execArgs?.length) {
    args.push(...options.execArgs);
  }

  // Add user-provided arguments
  if (options.args?.length) {
    args.push(...options.args);
  }

  // Insert user script at the correct position
  if (options.script) {
    const position =
      (options.scriptPosition || 0) + (options.execArgs?.length || 0);

    args.splice(position, 0, options.script);
  }

  return {
    executable,
    args,
  };
}
