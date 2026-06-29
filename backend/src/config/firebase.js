const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
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
    let serviceAccount;
    if (json) {
      serviceAccount = JSON.parse(json);
    } else {
      serviceAccount = require(require('path').resolve(path));
    }

    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    _messaging = getMessaging();
    logger.info('Firebase Admin initialised — push notifications enabled');
  } catch (err) {
    logger.error('Firebase init failed — push notifications disabled', { err: err.message });
  }
}

function getMessagingInstance() {
  return _messaging;
}

module.exports = { initFirebase, getMessaging: getMessagingInstance };
