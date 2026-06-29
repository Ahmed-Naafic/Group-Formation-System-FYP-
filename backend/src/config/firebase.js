const admin = require('firebase-admin');
const logger = require('../common/utils/logger');

let _messaging = null;

function initFirebase() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!json && !path) {
    logger.warn('Firebase not configured — push notifications disabled (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH)');
    return;
  }

  try {
    let credential;
    if (json) {
      credential = admin.credential.cert(JSON.parse(json));
    } else {
      credential = admin.credential.cert(require(path));
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }

    _messaging = admin.messaging();
    logger.info('Firebase Admin initialised — push notifications enabled');
  } catch (err) {
    logger.error('Firebase init failed — push notifications disabled', { err: err.message });
  }
}

function getMessaging() {
  return _messaging;
}

module.exports = { initFirebase, getMessaging };
