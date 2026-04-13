const Joi = require('joi');

const userRegistrationSchema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required()
});

const userLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const validateUserRegistration = (data) => userRegistrationSchema.validate(data);
const validateUserLogin = (data) => userLoginSchema.validate(data);

module.exports = {
    validateUserRegistration,
    validateUserLogin
};