const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(`${err.message} | ${req.method} ${req.originalUrl} | IP: ${req.ip}`);

    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
    }
    if (err.code === 11000) {
        return res.status(400).json({ message: 'Duplicate field value' });
    }

    res.status(err.status || 500).json({
        message: err.message || 'Internal server error'
    });
};

module.exports = errorHandler;