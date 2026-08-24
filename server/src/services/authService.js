const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (isMemoryStore()) {
    const existing = memoryStore.findOne('users', { email: normalizedEmail });
    if (existing) throw new ApiError(409, 'Email already registered');

    const hashed = await bcrypt.hash(password, 12);
    const user = memoryStore.insert('users', {
      name,
      email: normalizedEmail,
      password: hashed,
      role: 'operator',
      lastLoginAt: new Date().toISOString()
    });
    const token = signToken(user);
    const safe = { ...user };
    delete safe.password;
    return { user: safe, token };
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new ApiError(409, 'Email already registered');

  const user = await User.create({ name, email: normalizedEmail, password, role: 'operator' });
  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

async function login({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (isMemoryStore()) {
    const user = memoryStore.findOne('users', { email: normalizedEmail });
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new ApiError(401, 'Invalid email or password');

    memoryStore.update('users', user._id, { lastLoginAt: new Date().toISOString() });
    const token = signToken(user);
    const safe = { ...user };
    delete safe.password;
    return { user: safe, token };
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const match = await user.comparePassword(password);
  if (!match) throw new ApiError(401, 'Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save();
  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

module.exports = { register, login, sanitizeUser };
