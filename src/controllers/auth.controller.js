import * as authService from '../services/auth.service.js';
import { catchAsync } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  successResponse(res, { message: 'Participant registered successfully', data: result }, 201);
});

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  successResponse(res, { message: 'Login successful', data: result });
});

export const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  successResponse(res, { data: { user } });
});
