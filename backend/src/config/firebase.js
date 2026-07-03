const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getStorage }   = require('firebase-admin/storage');
const logger = require('../common/utils/logger');

let _messaging    = null;
let _storageBucket = null;

function initFirebase() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!json && !path) {
    logger.warn('Firebase not configured — push notifications and file storage disabled (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH)');
    return;
  }

  try {
    let serviceAccount;
    if (json) {
      serviceAccount = JSON.parse(json);
    } else {
      serviceAccount = require(require('path').resolve(path));
    }

    // Bucket name: explicit env var or auto-derived from the service account project_id
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET
      ?? `${serviceAccount.project_id}.appspot.com`;

    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
    }

    _messaging     = getMessaging();
    _storageBucket = getStorage().bucket();
    logger.info('Firebase Admin initialised — push notifications and file storage enabled');
  } catch (err) {
    logger.error('Firebase init failed — push notifications and file storage disabled', { err: err.message });
  }
}

function getMessagingInstance() {
  return _messaging;
}

function getStorageBucket() {
  return _storageBucket;
}

module.exports = { initFirebase, getMessaging: getMessagingInstance, getStorageBucket };
