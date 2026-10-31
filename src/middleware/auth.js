import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) throw new AppError('Not authorized — no token provided', 401);

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id);
    if (!user) throw new AppError('User belonging to this token no longer exists', 401);

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return next(new AppError('Invalid token', 401));
    if (error.name === 'TokenExpiredError') return next(new AppError('Token has expired', 401));
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
