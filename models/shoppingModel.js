const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema({
    fridgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fridge',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },

    similarInFridge: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FridgeItem'
        },
        name: String,
        quantity: Number,
        unit: String,
        expiryDate: Date
    }],
    ignoreDuplicate: {
        type: Boolean,
        default: false
    },

    isCompleted: {
        type: Boolean,
        default: false
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ShoppingItem', shoppingItemSchema);