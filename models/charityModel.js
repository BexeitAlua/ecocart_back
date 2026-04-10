const mongoose = require('mongoose');

const charitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a charity name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    city: {
        type: String,
        required: [true, 'Please specify the city (or "All")'],
        enum: ['All', 'Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktau', 'Atyrau', 'Other']
    },
    address: {
        type: String,
        required: true
    },
    contact: {
        type: String,
        required: true
    },
    website: {
        type: String,
        default: ''
    },
    imageUrl: {
        type: String,
        default: ''
    },
    needs: {
        type: [String], // e.g., ["Canned Food", "Rice", "Pasta"]
        default: []
    },
    verified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Charity', charitySchema);