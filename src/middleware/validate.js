import { AppError } from '../utils/AppError.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return next(new AppError(messages.join('; '), 400));
    }
    req[source] = result.data;
    next();
  };
};
