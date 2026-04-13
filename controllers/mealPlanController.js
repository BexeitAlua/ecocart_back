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

const getMealPlan = async (req, res) => {
    try {
        const { fridgeId, date } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });

        await checkFridgeAccess(fridgeId, req.user._id);

        const weekStartDate = getMondayDateString(date);
        let mealPlan = await MealPlan.findOne({ fridgeId, weekStartDate });

        if (!mealPlan) {
            mealPlan = await MealPlan.create({ fridgeId, weekStartDate });
            logger.info(`Created new meal plan for fridge ${fridgeId}, week ${weekStartDate}`);
        } else {
            logger.debug(`Fetched existing meal plan for fridge ${fridgeId}, week ${weekStartDate}`);
        }

        res.json(mealPlan);
    } catch (error) {
        logger.error(`getMealPlan error: ${error.message}`);
        res.status(error.status || 500).json({ message: error.message });
    }
};

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
                logger.info(`Cleared meal slot: fridge ${fridgeId} | ${day} ${mealType}`);
            } else {
                mealPlan.plan[day][mealType].recipeName = recipeName;
                if (ingredients) mealPlan.plan[day][mealType].ingredients = ingredients;
                mealPlan.plan[day][mealType].isAiGenerated = false;
                logger.info(`Updated meal slot: fridge ${fridgeId} | ${day} ${mealType} → "${recipeName}"`);
            }
            await mealPlan.save();
        }

        res.json(mealPlan);
    } catch (error) {
        logger.error(`updateMeal error: ${error.message}`);
        res.status(error.status || 400).json({ message: error.message });
    }
};

const generateAIPlan = async (req, res) => {
    try {
        const { fridgeId, date, language } = req.body;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });

        await checkFridgeAccess(fridgeId, req.user._id);

        const weekStartDate = getMondayDateString(date);
        logger.info(`Generating AI meal plan for fridge ${fridgeId}, week ${weekStartDate}, language ${language || 'EN'}`);

        const items = await FridgeItem.find({ fridgeId, status: { $ne: 'expired' } });
        const availableIngredients = items.map(i => i.name).join(', ');
        logger.debug(`Found ${items.length} fridge ingredients: ${availableIngredients || 'none'}`);

        const user = await User.findById(req.user._id);
        const dietary = user.dietaryPreferences || [];
        let dietText = dietary.length > 0 ? `CRITICAL: Do NOT use: ${dietary.join(', ')}.` : '';

        const getMockData = (lang) => {
            const mocks = {
                'RU': {
                    breakfast: { name: 'Овсяная каша с фруктами', ingredients: ['Овсянка', 'Молоко', 'Фрукты'] },
                    lunch: { name: 'Куриный суп', ingredients: ['Курица', 'Картофель', 'Морковь'] },
                    dinner: { name: 'Запеченная рыба с овощами', ingredients: ['Рыба', 'Овощи'] }
                },
                'KZ': {
                    breakfast: { name: 'Сүт қосылған сұлы ботқасы', ingredients: ['Сұлы', 'Сүт'] },
                    lunch: { name: 'Сорпа', ingredients: ['Ет', 'Картоп', 'Сәбіз'] },
                    dinner: { name: 'Көкөністермен пісірілген балық', ingredients: ['Балық', 'Көкөністер'] }
                },
                'EN': {
                    breakfast: { name: 'Oatmeal with Fruits', ingredients: ['Oats', 'Milk', 'Fruit'] },
                    lunch: { name: 'Chicken Soup', ingredients: ['Chicken', 'Potato', 'Carrot'] },
                    dinner: { name: 'Baked Fish with Veggies', ingredients: ['Fish', 'Vegetables'] }
                }
            };
            const selected = mocks[lang] || mocks['EN'];
            const fullWeek = {};
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(day => {
                fullWeek[day] = selected;
            });
            return fullWeek;
        };

        let resultJSON;
        let usedMock = false;

        try {
            const apiKey = process.env.OPENAI_API_KEY;
            const openai = new OpenAI({ apiKey });
            const targetLang = language === 'RU' ? 'Russian' : (language === 'KZ' ? 'Kazakh' : 'English');

            const prompt = `
            Create a 7-day meal plan (Monday to Sunday) for breakfast, lunch, and dinner.
            Prioritize using these ingredients: ${availableIngredients || 'basic pantry items'}.
            ${dietText}
            
            CRITICAL REQUIREMENT: 
            The meal names and ingredients MUST be written in ${targetLang}. 
            The JSON keys ("Monday", "breakfast", "name", "ingredients") must remain in English.

            Return ONLY valid JSON matching this exact structure:
            {
                "Monday": { 
                    "breakfast": { "name": "Овсянка", "ingredients":["Овес", "Молоко"] },
                    "lunch": { "name": "...", "ingredients":["..."] },
                    "dinner": { "name": "...", "ingredients": ["..."] }
                }
            }
            Keep ingredients array short. Do not output Markdown formatting.
        `;

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a professional meal planner. Output JSON only.' },
                    { role: 'user', content: prompt }
                ],
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                temperature: 0.7,
            });

            resultJSON = JSON.parse(completion.choices[0].message.content);
            logger.info(`AI meal plan generated successfully for fridge ${fridgeId}`);

        } catch (aiError) {
            logger.warn(`AI service unavailable for fridge ${fridgeId}: ${aiError.message} — falling back to mock data`);
            resultJSON = getMockData(language);
            usedMock = true;
        }

        let mealPlan = await MealPlan.findOne({ fridgeId, weekStartDate });
        if (!mealPlan) {
            mealPlan = new MealPlan({ fridgeId, weekStartDate });
            logger.debug(`Created new meal plan document for fridge ${fridgeId}`);
        }

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
        logger.info(`Meal plan saved for fridge ${fridgeId} | source: ${usedMock ? 'mock' : 'AI'}`);

        res.json(mealPlan);

    } catch (error) {
        logger.error(`generateAIPlan error for fridge ${req.body?.fridgeId}: ${error.message}`);
        res.status(error.status || 500).json({ message: error.message || 'Failed to generate meal plan' });
    }
};

module.exports = { getMealPlan, updateMeal, generateAIPlan };