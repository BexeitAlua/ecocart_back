
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        unique: true,
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
    city: {
        type: String,
        default: 'Almaty',
        enum: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Aktau', 'Atyrau', 'Kostanay', 'Pavlodar', 'Taraz', 'Semey', 'Kyzylorda', 'Zhezkazgan', 'Petropavl', 'Other']
    },
    pointsHistory: [{
        points: Number,
        reason: String,
        date: { type: Date, default: Date.now }
    }],

    efficiencyStats: {
        itemsConsumed: { type: Number, default: 0 },
        itemsWasted: { type: Number, default: 0 },
        totalMoneySaved: { type: Number, default: 0 },

        totalCo2Saved: { type: Number, default: 0 }
    },
    pushToken: { type: String },
    language: { type: String, enum: ['EN', 'RU', 'KZ'], default: 'EN' },
    dietaryPreferences: {
        type: [String],
        default: []
    },
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);