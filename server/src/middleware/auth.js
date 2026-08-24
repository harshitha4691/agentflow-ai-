const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const User = require('../models/User');

async function auth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    let user;
    if (isMemoryStore()) {
      user = memoryStore.findOne('users', { _id: decoded.id });
    } else {
      user = await User.findById(decoded.id).lean();
    }

    if (!user) {
      return next(new ApiError(401, 'User not found'));
    }

    req.user = user;
    next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = auth;
