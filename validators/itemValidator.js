const Joi = require('joi');

const createItemSchema = Joi.object({
    fridgeId: Joi.string().required().messages({
        'any.required': 'Fridge ID is required'
    }),
    name: Joi.string().min(1).max(100).required().messages({
        'any.required': 'Item name is required'
    }),
    expiryDate: Joi.date().required().messages({
        'any.required': 'Expiry date is required'
    }),
    category: Joi.string().valid(
        'Dairy', 'Fruit', 'Vegetables', 'Meat', 'Beverages',
        'Snacks', 'Grains', 'Condiments', 'Frozen', 'Other'
    ).default('Other'),
    quantity: Joi.number().min(0).default(1),
    unit: Joi.string().default('piece'),
    imageUrl: Joi.string().allow('', null),
    barcode: Joi.string().allow('', null),
    notes: Joi.string().max(500).allow('', null)
});

const updateItemSchema = Joi.object({
    name: Joi.string().min(1).max(100),
    expiryDate: Joi.date(),
    category: Joi.string().valid(
        'Dairy', 'Fruit', 'Vegetables', 'Meat', 'Beverages',
        'Snacks', 'Grains', 'Condiments', 'Frozen', 'Other'
    ),
    quantity: Joi.number().min(0),
    unit: Joi.string(),
    imageUrl: Joi.string().allow('', null),
    notes: Joi.string().max(500).allow('', null)
});

module.exports = { createItemSchema, updateItemSchema };