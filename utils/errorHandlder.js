const sendError = (res, status, message, code = null, details = null) => {
    const response = {
        success: false,
        error: {
            message,
            code: code || status
        }
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(status).json(response);
};

const sendSuccess = (res, status = 200, message = 'Success', data = null) => {
    const response = {
        success: true,
        message
    };

    if (data !== null && data !== undefined) {
        response.data = data;
    }

    return res.status(status).json(response);
};

const ErrorCodes = {
    INVALID_REQUEST: 'INVALID_REQUEST',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',

    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    FRIDGE_NOT_FOUND: 'FRIDGE_NOT_FOUND',
    FRIDGE_ACCESS_DENIED: 'FRIDGE_ACCESS_DENIED',
    INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
    ALREADY_MEMBER: 'ALREADY_MEMBER',

    ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
    DUPLICATE_ITEM: 'DUPLICATE_ITEM',

    POST_NOT_FOUND: 'POST_NOT_FOUND',
    RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',

    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS'
};

const errorHandlder = (err, req, res, next) => {
    console.error('[Error]', err);

    let status = err.status || 500;
    let message = err.message || 'Internal Server Error';
    let code = err.code || ErrorCodes.INTERNAL_SERVER_ERROR;
    let details = err.details || null;

    if (err.name === 'ValidationError') {
        status = 400;
        code = ErrorCodes.VALIDATION_ERROR;
        details = Object.keys(err.errors).reduce((acc, key) => {
            acc[key] = err.errors[key].message;
            return acc;
        }, {});
    }

    if (err.code === 11000) {
        status = 400;
        code = ErrorCodes.DUPLICATE_ITEM;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
    }

    if (err.name === 'JsonWebTokenError') {
        status = 401;
        code = ErrorCodes.INVALID_TOKEN;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        status = 401;
        code = ErrorCodes.TOKEN_EXPIRED;
        message = 'Token expired';
    }

    return sendError(res, status, message, code, details);
};

const validateRequired = (obj, fields) => {
    const missing = [];
    fields.forEach(field => {
        if (!obj[field] || (typeof obj[field] === 'string' && !obj[field].trim())) {
            missing.push(field);
        }
    });
    return missing;
};

const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const validateEnum = (value, validValues) => {
    return validValues.includes(value);
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    sendError,
    sendSuccess,
    ErrorCodes,
    errorHandler: errorHandlder,
    validateRequired,
    validateEmail,
    validateEnum,
    asyncHandler
};