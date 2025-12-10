"use strict";

const utils = require("./utils");

module.exports = (ast, options = {}) => {
  /**
   * Convert AST nodes back to a string
   */
  const stringify = (node, parent = {}) => {
    let result = "";

    const escapeInvalid = options.escapeInvalid === true;

    // Determine if the parent block or the node itself is invalid
    const blockIsInvalid = escapeInvalid && utils.isInvalidBrace(parent);
    const nodeIsInvalid = escapeInvalid && node.invalid === true;

    /**
     * CASE 1: Node has a direct value (text, brace, comma, etc.)
     */
    if (node.value) {
      // If it's an open or close brace and is invalid → escape it
      if ((blockIsInvalid || nodeIsInvalid) && utils.isOpenOrClose(node)) {
        return "\\" + node.value;
      }

      return node.value; // normal text
    }

    /**
     * CASE 2: Node contains children (complex structure)
     */
    if (node.nodes) {
      for (const child of node.nodes) {
        result += stringify(child, node);
      }
    }

    return result;
  };

  return stringify(ast);
};
