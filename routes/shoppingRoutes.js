const express = require('express');
const { getAll, create, toggle, deleteItem, ignoreDuplicate, moveToFridge } = require('../controllers/shoppingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/shopping:
 *   get:
 *     summary: Get all shopping list items
 *     tags: [Shopping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Fridge ID to get shopping list for
 *     responses:
 *       200:
 *         description: List of shopping items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShoppingItem'
 *       400:
 *         description: Fridge ID required
 *       403:
 *         description: Access denied
 */
router.get('/', getAll);

/**
 * @swagger
 * /api/shopping:
 *   post:
 *     summary: Add item to shopping list
 *     tags: [Shopping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fridgeId, text]
 *             properties:
 *               fridgeId:
 *                 type: string
 *               text:
 *                 type: string
 *                 example: Organic milk
 *     responses:
 *       201:
 *         description: Shopping item created. Includes similarInFridge if duplicates detected.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingItem'
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Access denied
 */
router.post('/', create);

/**
 * @swagger
 * /api/shopping/move-to-fridge:
 *   post:
 *     summary: Move completed shopping items to fridge
 *     tags: [Shopping]
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
 *     responses:
 *       200:
 *         description: Completed items moved to fridge
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Items moved to fridge
 *                 movedCount:
 *                   type: number
 *                   example: 3
 *       400:
 *         description: Fridge ID required
 *       403:
 *         description: Access denied
 */
router.post('/move-to-fridge', moveToFridge);

/**
 * @swagger
 * /api/shopping/{id}/toggle:
 *   put:
 *     summary: Toggle item completion status
 *     tags: [Shopping]
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
 *         description: Item toggled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingItem'
 *       404:
 *         description: Item not found
 */
router.put('/:id/toggle', toggle);

/**
 * @swagger
 * /api/shopping/{id}/ignore-duplicate:
 *   put:
 *     summary: Ignore duplicate warning for a shopping item
 *     tags: [Shopping]
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
 *         description: Duplicate warning ignored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingItem'
 *       404:
 *         description: Item not found
 */
router.put('/:id/ignore-duplicate', ignoreDuplicate);

/**
 * @swagger
 * /api/shopping/{id}:
 *   delete:
 *     summary: Delete a shopping item
 *     tags: [Shopping]
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
 *         description: Item deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       404:
 *         description: Item not found
 */
router.delete('/:id', deleteItem);

module.exports = router;