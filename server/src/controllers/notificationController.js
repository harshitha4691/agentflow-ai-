const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listNotifications(String(req.user._id));
  res.json({ notifications });
});

module.exports = { list };
