const mongoose = require('mongoose');

const mealSlotSchema = new mongoose.Schema({
    recipeId: { type: String, default: null },
    recipeName: { type: String, default: '' },
    ingredients: [{ type: String }],
    isAiGenerated: { type: Boolean, default: false },
    notes: { type: String, default: '' }
});

const dayPlanSchema = new mongoose.Schema({
    date: { type: String, required: true },
    breakfast: { type: mealSlotSchema, default: () => ({}) },
    lunch: { type: mealSlotSchema, default: () => ({}) },
    dinner: { type: mealSlotSchema, default: () => ({}) }
});

const mealPlanSchema = new mongoose.Schema({
    fridgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fridge', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    weekStart: { type: String, required: true },
    days: [dayPlanSchema],
    isAiGenerated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);