const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
    recipeName: { type: String, default: '' },
    ingredients: { type: [String], default: [] },
    isAiGenerated: { type: Boolean, default: false },
    isCooked: { type: Boolean, default: false }
}, { _id: false });

const daySchema = new mongoose.Schema({
    breakfast: { type: mealSchema, default: () => ({}) },
    lunch: { type: mealSchema, default: () => ({}) },
    dinner: { type: mealSchema, default: () => ({}) }
}, { _id: false });

const mealPlanSchema = new mongoose.Schema({
    fridgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fridge',
        required: true
    },
    weekStartDate: {
        type: String,
        required: true
    },
    plan: {
        Monday: { type: daySchema, default: () => ({}) },
        Tuesday: { type: daySchema, default: () => ({}) },
        Wednesday: { type: daySchema, default: () => ({}) },
        Thursday: { type: daySchema, default: () => ({}) },
        Friday: { type: daySchema, default: () => ({}) },
        Saturday: { type: daySchema, default: () => ({}) },
        Sunday: { type: daySchema, default: () => ({}) }
    }
}, { timestamps: true });


mealPlanSchema.index({ fridgeId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);