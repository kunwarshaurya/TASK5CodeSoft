export const successResponse = (res, data, statusCode = 200, meta = {}) => {
  const response = { success: true, ...data };
  if (Object.keys(meta).length > 0) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const paginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total, page, limit, totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
