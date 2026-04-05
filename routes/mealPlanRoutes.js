const express = require('express');
const { getMealPlan, updateMeal, generateAIPlan } = require('../controllers/mealPlanController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

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
 *         description: Fridge ID
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *         description: Start date of the week (Monday) in YYYY-MM-DD format
 *         example: '2026-03-24'
 *     responses:
 *       200:
 *         description: Weekly meal plan (created if not exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlan'
 *       400:
 *         description: fridgeId and weekStart required
 *       403:
 *         description: Access denied
 */
router.get('/', getMealPlan);

/**
 * @swagger
 * /api/meal-plan/generate-ai:
 *   post:
 *     summary: Generate AI meal plan based on expiring ingredients
 *     description: |
 *       Automatically creates a 7-day meal plan using ingredients from the fridge.
 *       Prioritizes ingredients that are expiring soon (within 7 days).
 *       If OpenAI is unavailable, uses rule-based fallback generation.
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fridgeId, weekStart]
 *             properties:
 *               fridgeId:
 *                 type: string
 *               weekStart:
 *                 type: string
 *                 example: '2026-03-24'
 *     responses:
 *       200:
 *         description: AI generated meal plan for the week
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlan'
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Access denied
 *       500:
 *         description: AI generation failed
 */
router.post('/generate', generateAIPlan);

/**
 * @swagger
 * /api/meal-plan/{planId}/slot:
 *   put:
 *     summary: Update a specific meal slot manually
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meal Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, mealType, recipeName]
 *             properties:
 *               date:
 *                 type: string
 *                 example: '2026-03-24'
 *                 description: Date in YYYY-MM-DD format
 *               mealType:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner]
 *                 example: breakfast
 *               recipeName:
 *                 type: string
 *                 example: Omelette with tomatoes
 *               notes:
 *                 type: string
 *                 example: Use the expiring eggs
 *     responses:
 *       200:
 *         description: Meal slot updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlan'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Plan or day not found
 */
router.put('/meal', updateMeal);



module.exports = router;