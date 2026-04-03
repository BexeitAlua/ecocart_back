const MealPlan = require('../models/mealPlanModel');
const FridgeItem = require('../models/itemModel');
const Fridge = require('../models/fridgeModel');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getWeekDates = (weekStart) => {
    const dates = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};

const getOrCreateMealPlan = async (req, res) => {
    try {
        const { fridgeId, weekStart } = req.query;
        if (!fridgeId || !weekStart) return res.status(400).json({ message: 'fridgeId and weekStart required' });

        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });

        let plan = await MealPlan.findOne({ fridgeId, weekStart });

        if (!plan) {
            const dates = getWeekDates(weekStart);
            plan = await MealPlan.create({
                fridgeId,
                userId: req.user._id,
                weekStart,
                days: dates.map(date => ({ date, breakfast: {}, lunch: {}, dinner: {} }))
            });
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateMealSlot = async (req, res) => {
    try {
        const { planId } = req.params;
        const { date, mealType, recipeName, notes } = req.body;

        const plan = await MealPlan.findById(planId);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const fridge = await Fridge.findById(plan.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });

        const day = plan.days.find(d => d.date === date);
        if (!day) return res.status(404).json({ message: 'Day not found' });

        day[mealType] = { recipeName, notes, isAiGenerated: false };
        await plan.save();

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const clearMealSlot = async (req, res) => {
    try {
        const { planId } = req.params;
        const { date, mealType } = req.body;

        const plan = await MealPlan.findById(planId);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const fridge = await Fridge.findById(plan.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });

        const day = plan.days.find(d => d.date === date);
        if (!day) return res.status(404).json({ message: 'Day not found' });

        day[mealType] = { recipeName: '', notes: '', isAiGenerated: false };
        await plan.save();

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const generateAiMealPlan = async (req, res) => {
    try {
        const { fridgeId, weekStart } = req.body;
        if (!fridgeId || !weekStart) return res.status(400).json({ message: 'fridgeId and weekStart required' });

        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });

        const items = await FridgeItem.find({ fridgeId });
        const expiringItems = items
            .filter(item => {
                const days = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                return days <= 7;
            })
            .map(item => item.name);

        const allItems = items.map(item => item.name);

        const prompt = `You are a meal planning assistant. Create a 7-day meal plan using these fridge ingredients.

Priority ingredients (expiring soon): ${expiringItems.join(', ') || 'none'}
All available ingredients: ${allItems.join(', ') || 'none'}

Return ONLY a valid JSON array with exactly 7 objects, one per day. Each object must have this exact structure:
{
  "date": "YYYY-MM-DD",
  "breakfast": { "recipeName": "name", "ingredients": ["ing1", "ing2"] },
  "lunch": { "recipeName": "name", "ingredients": ["ing1", "ing2"] },
  "dinner": { "recipeName": "name", "ingredients": ["ing1", "ing2"] }
}

Start dates from ${weekStart}. Use simple, realistic meal names. Prioritize expiring ingredients.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.7
        });

        let aiResponse = completion.choices[0].message.content.trim();
        aiResponse = aiResponse.replace(/```json|```/g, '').trim();
        const aiDays = JSON.parse(aiResponse);

        let plan = await MealPlan.findOne({ fridgeId, weekStart });
        if (!plan) {
            plan = await MealPlan.create({
                fridgeId,
                userId: req.user._id,
                weekStart,
                days: aiDays.map(d => ({
                    date: d.date,
                    breakfast: { ...d.breakfast, isAiGenerated: true },
                    lunch: { ...d.lunch, isAiGenerated: true },
                    dinner: { ...d.dinner, isAiGenerated: true }
                })),
                isAiGenerated: true
            });
        } else {
            plan.days = aiDays.map(d => ({
                date: d.date,
                breakfast: { ...d.breakfast, isAiGenerated: true },
                lunch: { ...d.lunch, isAiGenerated: true },
                dinner: { ...d.dinner, isAiGenerated: true }
            }));
            plan.isAiGenerated = true;
            await plan.save();
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const generateShoppingFromPlan = async (req, res) => {
    try {
        const { planId } = req.params;

        const plan = await MealPlan.findById(planId);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const fridge = await Fridge.findById(plan.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });

        const fridgeItems = await FridgeItem.find({ fridgeId: plan.fridgeId });
        const fridgeNames = fridgeItems.map(i => i.name.toLowerCase());

        const neededIngredients = new Set();
        plan.days.forEach(day => {
            ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
                const meal = day[mealType];
                if (meal?.ingredients?.length) {
                    meal.ingredients.forEach(ing => {
                        if (!fridgeNames.some(f => f.includes(ing.toLowerCase()))) {
                            neededIngredients.add(ing);
                        }
                    });
                }
            });
        });

        const ShoppingItem = require('../models/shoppingModel');
        let addedCount = 0;
        for (const ingredient of neededIngredients) {
            const exists = await ShoppingItem.findOne({ fridgeId: plan.fridgeId, text: ingredient });
            if (!exists) {
                await ShoppingItem.create({ fridgeId: plan.fridgeId, text: ingredient, addedBy: req.user._id });
                addedCount++;
            }
        }

        res.json({ message: `Added ${addedCount} items to shopping list`, addedCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getOrCreateMealPlan, updateMealSlot, clearMealSlot, generateAiMealPlan, generateShoppingFromPlan };