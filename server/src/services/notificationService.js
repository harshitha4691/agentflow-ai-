const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const Notification = require('../models/Notification');
const { emitEvent } = require('../config/socket');

async function createNotification(payload) {
  let notification;
  if (isMemoryStore()) {
    notification = memoryStore.insert('notifications', payload);
  } else {
    notification = (await Notification.create(payload)).toObject();
  }

  emitEvent(null, 'notification:new', notification);
  return notification;
}

async function listNotifications(owner) {
  if (isMemoryStore()) {
    return memoryStore.list('notifications', { owner })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return Notification.find({ owner }).sort({ createdAt: -1 }).lean();
}

module.exports = { createNotification, listNotifications };
