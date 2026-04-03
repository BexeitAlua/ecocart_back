const express = require('express');
const {
    getOrCreateMealPlan, updateMealSlot,
    clearMealSlot, generateAiMealPlan, generateShoppingFromPlan
} = require('../controllers/mealPlanController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

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
 *         description: Start date of the week (Monday)
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
router.get('/', protect, getOrCreateMealPlan);

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
router.post('/generate-ai', protect, generateAiMealPlan);

/**
 * @swagger
 * /api/meal-plan/{planId}/slot:
 *   put:
 *     summary: Update a specific meal slot
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
router.put('/:planId/slot', protect, updateMealSlot);

/**
 * @swagger
 * /api/meal-plan/{planId}/slot:
 *   delete:
 *     summary: Clear a specific meal slot
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, mealType]
 *             properties:
 *               date:
 *                 type: string
 *                 example: '2026-03-24'
 *               mealType:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner]
 *     responses:
 *       200:
 *         description: Meal slot cleared
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlan'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Plan or day not found
 */
router.delete('/:planId/slot', protect, clearMealSlot);

/**
 * @swagger
 * /api/meal-plan/{planId}/generate-shopping:
 *   post:
 *     summary: Generate shopping list from meal plan ingredients
 *     description: |
 *       Compares meal plan ingredients with current fridge contents.
 *       Adds missing ingredients to the shopping list automatically.
 *     tags: [Meal Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shopping list updated with missing ingredients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Added 5 items to shopping list
 *                 addedCount:
 *                   type: number
 *                   example: 5
 *       403:
 *         description: Access denied
 *       404:
 *         description: Plan not found
 */
router.post('/:planId/generate-shopping', protect, generateShoppingFromPlan);

module.exports = router;