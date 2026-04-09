
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please fill a valid email address',
        ],
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false,
    },
    ecoPoints: {
        type: Number,
        default: 0
    },
    pushToken: { type: String },
    dietaryPreferences: {
        type: [String],
        default: []
    },
    efficiencyStats: {
        itemsConsumed: { type: Number, default: 0 },
        itemsWasted: { type: Number, default: 0 },
        totalMoneySaved: { type: Number, default: 0 },
        totalCo2Saved: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);