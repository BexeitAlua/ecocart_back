const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema({
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please add item name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add description']
    },

    location: {
        city: {
            type: String,
            required: true,
            enum: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktau', 'Atyrau', 'Other']
        },
        district: String,
        publicDescription: {
            type: String,
            required: true
        },


        approximateCoords: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true }
        },


        exactAddress: String,
        exactCoords: {
            latitude: Number,
            longitude: Number
        },


        shareExactLocation: {
            type: Boolean,
            default: false
        }
    },

    contact: {
        type: String,
        required: [true, 'Please add contact info']
    },
    imageUrl: String,

    status: {
        type: String,
        enum: ['available', 'reserved', 'taken'],
        default: 'available'
    },

    tags: [String],


    reservations: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'cancelled'],
            default: 'pending'
        },
        message: String,
        pickupTime: Date,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],


    messages: [{
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        message: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    viewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

communityPostSchema.methods.getPublicLocation = function () {
    return {
        city: this.location.city,
        district: this.location.district,
        description: this.location.publicDescription,
        approximateCoords: this.location.approximateCoords
    };
};

communityPostSchema.methods.canSeeExactLocation = function (userId) {
    if (this.postedBy.toString() === userId.toString()) {
        return true;
    }

    const confirmedReservation = this.reservations.find(
        r => r.userId.toString() === userId.toString() && r.status === 'confirmed'
    );

    return !!confirmedReservation;
};


communityPostSchema.statics.calculateDistance = function (lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

module.exports = mongoose.model('CommunityPost', communityPostSchema);