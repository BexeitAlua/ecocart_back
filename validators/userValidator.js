const Joi = require('joi');

const validateUserRegistration = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(50).required().messages({
            'string.min': 'Name must be at least 2 characters',
            'string.max': 'Name must be less than 50 characters',
            'any.required': 'Name is required'
        }),
        email: Joi.string().email().required().messages({
            'string.email': 'Please enter a valid email',
            'any.required': 'Email is required'
        }),
        password: Joi.string().min(6).required().messages({
            'string.min': 'Password must be at least 6 characters',
            'any.required': 'Password is required'
        })
    });
    return schema.validate(data);
};

const validateUserLogin = (data) => {
    const schema = Joi.object({
        username: Joi.string().min(2).max(50).required().messages({
            'string.min': 'Username must be at least 2 characters',
            'any.required': 'Username is required'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    });
    return schema.validate(data);
};

module.exports = { validateUserRegistration, validateUserLogin };