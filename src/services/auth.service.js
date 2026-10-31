import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/index.js';
import { AppError } from '../utils/AppError.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

export const register = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError('Email already registered', 409);

  // Public registration always creates 'participant' — never allow role escalation
  const user = await User.create({ name, email, password, role: 'participant' });
  const token = generateToken(user._id);
  return { user: user.toJSON(), token };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const token = generateToken(user._id);
  return { user: user.toJSON(), token };
};

export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user.toJSON();
};
