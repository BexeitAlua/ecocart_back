const express = require('express');
const { generateRecipes } = require('../controllers/recipeController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/recipes/generate:
 *   post:
 *     summary: Generate AI recipes based on selected ingredients
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ingredients]
 *             properties:
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['Milk', 'Eggs', 'Tomatoes', 'Cheese']
 *               dietaryPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['Vegetarian']
 *               fridgeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI-generated recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         example: Vegetable Omelette
 *                       description:
 *                         type: string
 *                       ingredients:
 *                         type: array
 *                         items:
 *                           type: string
 *                       instructions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       cookTime:
 *                         type: string
 *                         example: 15 minutes
 *                       difficulty:
 *                         type: string
 *                         example: Easy
 *       500:
 *         description: AI generation failed (check OpenAI quota)
 */
router.post('/generate', protect, generateRecipes);

module.exports = router;