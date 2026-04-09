const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({

    fridgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fridge',
        required: [true, 'Fridge ID is required']
    },

    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    barcode: { type: String },
    brand: { type: String, trim: true },
    imageUrl: { type: String },

    productionDate: { type: Date },
    purchaseDate: { type: Date, default: Date.now },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },

    // Quantity & Category
    quantity: { type: Number, default: 1, min: 1 },
    unit: { type: String, default: 'piece', trim: true },
    category: {
        type: String,
        enum: {
            values: ['Dairy', 'Fruit', 'Vegetables', 'Meat', 'Beverages', 'Snacks', 'Other'],
            message: '{VALUE} is not a valid category'
        },
        default: 'Other'
    },

    // Status (calculated based on expiry)
    status: {
        type: String,
        enum: ['fresh', 'expiring', 'expired'],
        default: 'fresh'
    },

    // Optional
    notes: { type: String },

    // Track who added this item (useful for shared fridges)
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Method to calculate status based on expiry date
itemSchema.methods.calculateStatus = function () {
    const now = new Date();
    const expiry = new Date(this.expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
        this.status = 'expired';
    } else if (daysUntilExpiry <= 3) {
        this.status = 'expiring';
    } else {
        this.status = 'fresh';
    }

    return this.status;
};

// Auto-calculate status before saving
itemSchema.pre('save', function () {
    this.calculateStatus();
});

module.exports = mongoose.model('FridgeItem', itemSchema);