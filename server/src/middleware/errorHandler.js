function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const response = {
    message: error.message || 'Unexpected server error'
  };
  if (error.details) {
    response.details = error.details;
  }
  if (process.env.NODE_ENV === 'development' && !error.statusCode) {
    response.stack = error.stack;
  }
  res.status(statusCode).json(response);
}

module.exports = errorHandler;
