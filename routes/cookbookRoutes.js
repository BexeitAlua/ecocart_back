const express = require('express');
const { saveRecipe, getMyRecipes, deleteRecipe } = require('../controllers/cookbookController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/cookbook:
 *   get:
 *     summary: Get all saved recipes (user's cookbook)
 *     tags: [Cookbook]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                     example: Vegetable Omelette
 *                   description:
 *                     type: string
 *                   ingredients:
 *                     type: array
 *                     items:
 *                       type: string
 *                   instructions:
 *                     type: array
 *                     items:
 *                       type: string
 *                   cookTime:
 *                     type: string
 *                   difficulty:
 *                     type: string
 *                   savedAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/', getMyRecipes);

/**
 * @swagger
 * /api/cookbook:
 *   post:
 *     summary: Save a recipe to cookbook
 *     tags: [Cookbook]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Vegetable Omelette
 *               description:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['2 eggs', '1 tomato', '50g cheese']
 *               instructions:
 *                 type: array
 *                 items:
 *                   type: string
 *               cookTime:
 *                 type: string
 *                 example: 15 minutes
 *               difficulty:
 *                 type: string
 *                 example: Easy
 *     responses:
 *       201:
 *         description: Recipe saved to cookbook
 *       400:
 *         description: Recipe already saved
 */
router.post('/', saveRecipe);

/**
 * @swagger
 * /api/cookbook/{id}:
 *   delete:
 *     summary: Delete a recipe from cookbook
 *     tags: [Cookbook]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe deleted from cookbook
 *       403:
 *         description: Not authorized to delete this recipe
 *       404:
 *         description: Recipe not found
 */
router.delete('/:id', deleteRecipe);

module.exports = router;