'use strict';

const EventEmitter = require('events');
const debug = require('debug')('nodemon');
const util = require('util');

/**
 * Bus class to handle event communication
 * Inherits from Node.js EventEmitter
 */
class Bus extends EventEmitter {
  constructor() {
    super();

    // Track first-time listeners for logging purposes
    this._collected = {};

    // Wrap newListener to log debug info when listeners are added
    this.on('newListener', (event) => {
      debug('bus new listener: %s (%s)', event, this.listeners(event).length);

      if (!this._collected[event]) {
        this._collected[event] = true;

        // Log debug message every time the event is emitted
        this.on(event, () => {
          debug('bus emit: %s', event);
        });
      }
    });

    // If this process receives messages (when forked), forward to bus
    process.on('message', (event) => {
      debug('process.message(%s)', event);
      this.emit(event);
    });

    // If nodemon was forked, wrap emit to also send messages upstream
    if (process.send) {
      const originalEmit = this.emit.bind(this);

      this.emit = (event, ...args) => {
        process.send({ type: event, data: args[0] }); // send first argument as data
        originalEmit(event, ...args); // still emit locally
      };
    }
  }
}

// Export a single shared bus instance
const bus = new Bus();
module.exports = bus;
