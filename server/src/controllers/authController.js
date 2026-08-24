const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = { ...req.user };
  delete user.password;
  res.json({ user });
});

module.exports = { register, login, me };
