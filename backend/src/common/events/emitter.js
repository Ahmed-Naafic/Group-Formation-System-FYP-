const { EventEmitter } = require('events');

// Singleton application event bus.
// Modules emit typed events here; listener modules (notification, auditLog) subscribe.
// Keeps cross-module coupling at import-of-emitter level only — emitters never
// import the listener modules.
const emitter = new EventEmitter();

// Raise the default listener limit slightly — several modules may subscribe to the same event.
emitter.setMaxListeners(20);

module.exports = emitter;
