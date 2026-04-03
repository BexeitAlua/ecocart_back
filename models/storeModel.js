const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    chain: {
        type: String,
        enum: ['Small', 'Magnum', 'Ramstore', 'Arbat', 'Green', 'Ayan', 'Other'],
        default: 'Other'
    },
    city: {
        type: String,
        required: true,
        enum: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktau', 'Atyrau', 'Other']
    },
    location: {
        address: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },

    // Product availability and pricing
    products: [{
        name: String,
        category: String,
        barcode: String,
        price: Number,
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }],

    // User ratings
    ratings: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],

    averageRating: {
        type: Number,
        default: 0
    },

    // Store characteristics
    openHours: String,
    hasParking: Boolean,
    acceptsCards: Boolean
}, {
    timestamps: true
});

// Calculate average rating
storeSchema.methods.updateAverageRating = function () {
    if (this.ratings.length === 0) {
        this.averageRating = 0;
    } else {
        const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
        this.averageRating = sum / this.ratings.length;
    }
};

module.exports = mongoose.model('Store', storeSchema);