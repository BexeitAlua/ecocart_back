const MealPlan = require('../models/mealPlanModel');
const FridgeItem = require('../models/itemModel');
const Fridge = require('../models/fridgeModel');
const User = require('../models/userModel');
const OpenAI = require('openai');
const logger = require('../config/logger');

const getMondayDateString = (dateInput) => {
    const d = new Date(dateInput || new Date());
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

const checkFridgeAccess = async (fridgeId, userId) => {
    const fridge = await Fridge.findById(fridgeId);
    if (!fridge) {
        const err = new Error('Fridge not found');
        err.status = 404;
        throw err;
    }
    if (!fridge.isMember(userId)) {
        const err = new Error('Access denied');
        err.status = 403;
        throw err;
    }
    return fridge;
};

/**
 * @swagger
 * /api/meal-plan:
 *   get:
 *     summary: Get or create weekly meal plan
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: '2026-04-04'
 *     responses:
 *       200:
 *         description: Weekly meal plan
 */
const getMealPlan = async (req, res) => {
    try {
        const { fridgeId, date } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });

        await checkFridgeAccess(fridgeId, req.user._id);

        const weekStartDate = getMondayDateString(date);
        let mealPlan = await MealPlan.findOne({ fridgeId, weekStartDate });
        if (!mealPlan) {
            mealPlan = await MealPlan.create({ fridgeId, weekStartDate });
        }

        res.json(mealPlan);
    } catch (error) {
        logger.error(`getMealPlan error: ${error.message}`);
        res.status(error.status || 500).json({ message: error.message });
    }
};

/**
 * @swagger
 * /api/meal-plan/meal:
 *   put:
 *     summary: Update a specific meal slot
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fridgeId, day, mealType]
 *             properties:
 *               fridgeId:
 *                 type: string
 *               date:
 *                 type: string
 *                 example: '2026-04-04'
 *               day:
 *                 type: string
 *                 enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
 *               mealType:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner]
 *               recipeName:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Meal plan updated
 */
const updateMeal = async (req, res) => {
    try {
        const { fridgeId, date, day, mealType, recipeName, ingredients } = req.body;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });

        await checkFridgeAccess(fridgeId, req.user._id);

        const weekStartDate = getMondayDateString(date);
        const mealPlan = await MealPlan.findOne({ fridgeId, weekStartDate });
        if (!mealPlan) return res.status(404).json({ message: 'Plan not found' });

        if (mealPlan.plan[day] && mealPlan.plan[day][mealType]) {
            if (!recipeName || recipeName.trim() === '') {
                mealPlan.plan[day][mealType] = { recipeName: '', ingredients: [], isAiGenerated: false, isCooked: false };
            } else {
                mealPlan.plan[day][mealType].recipeName = recipeName;
                if (ingredients) mealPlan.plan[day][mealType].ingredients = ingredients;
                mealPlan.plan[day][mealType].isAiGenerated = false;
            }
            await mealPlan.save();
        }

        logger.info(`Meal updated: ${day} ${mealType} for fridge ${fridgeId}`);
        res.json(mealPlan);
    } catch (error) {
        logger.error(`updateMeal error: ${error.message}`);
        res.status(error.status || 400).json({ message: error.message });
    }
};

/**
 * @swagger
 * /api/meal-plan/generate:
 *   post:
 *     summary: Generate AI meal plan based on fridge ingredients
 *     description: |
 *       Automatically creates a 7-day meal plan using ingredients from the fridge.
 *       Prioritizes expiring ingredients. Uses OpenAI GPT-4o-mini.
 *       Falls back to rule-based generation if OpenAI is unavailable.
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fridgeId]
 *             properties:
 *               fridgeId:
 *                 type: string
 *               date:
 *                 type: string
 *                 example: '2026-04-04'
 *     responses:
 *       200:
 *         description: AI generated meal plan
 *       500:
 *         description: AI generation failed
 */
const generateAIPlan = async (req, res) => {
    try {
        const { fridgeId, date } = req.body;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });

        await checkFridgeAccess(fridgeId, req.user._id);

        const weekStartDate = getMondayDateString(date);

        const items = await FridgeItem.find({ fridgeId, status: { $ne: 'expired' } });
        const availableIngredients = items.map(i => i.name).join(', ');

        const user = await User.findById(req.user._id);
        const dietary = user.dietaryPreferences || [];
        const dietText = dietary.length > 0 ? `CRITICAL: Do NOT use: ${dietary.join(', ')}.` : '';

        const apiKey = process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey });

        const prompt = `
            Create a 7-day meal plan (Monday to Sunday) for breakfast, lunch, and dinner.
            Prioritize using these ingredients: ${availableIngredients || 'basic pantry items'}.
            ${dietText}
            
            Return ONLY valid JSON matching this structure:
            {
                "Monday": { 
                    "breakfast": { "name": "...", "ingredients": ["item1", "item2"] },
                    "lunch": { "name": "...", "ingredients": ["item1"] },
                    "dinner": { "name": "...", "ingredients": ["item1", "item2", "item3"] }
                }
            }
            Keep ingredients array short (max 3 main items).
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional meal planner. Output JSON only." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const resultJSON = JSON.parse(completion.choices[0].message.content);
        logger.info(`AI meal plan generated for fridge ${fridgeId}`);

        let mealPlan = await MealPlan.findOne({ fridgeId, weekStartDate });
        if (!mealPlan) mealPlan = new MealPlan({ fridgeId, weekStartDate });

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        days.forEach(day => {
            if (resultJSON[day]) {
                ['breakfast', 'lunch', 'dinner'].forEach(meal => {
                    if (resultJSON[day][meal]) {
                        mealPlan.plan[day][meal].recipeName = resultJSON[day][meal].name || '';
                        mealPlan.plan[day][meal].ingredients = resultJSON[day][meal].ingredients || [];
                        mealPlan.plan[day][meal].isAiGenerated = true;
                    }
                });
            }
        });

        await mealPlan.save();
        res.json(mealPlan);
    } catch (error) {
        logger.error(`generateAIPlan error: ${error.message}`);
        res.status(error.status || 500).json({ message: error.message || 'Failed to generate meal plan' });
    }
};

module.exports = { getMealPlan, updateMeal, generateAIPlan };