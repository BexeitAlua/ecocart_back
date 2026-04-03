const mongoose = require('mongoose');

const cookbookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: { type: String, required: true },
    time: String,
    difficulty: String,
    calories: String,
    ingredients: [String],
    instructions: [String]
}, {
    timestamps: true
});

module.exports = mongoose.model('CookbookRecipe', cookbookSchema);