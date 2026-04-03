const express = require('express');
const {
    getItems, getItem, lookupBarcode, createItem, updateItem,
    deleteItem, consumeItem, wasteItem, getExpiringItems, getItemsByCategory, getStats
} = require('../controllers/itemController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: Get all items in a fridge
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the fridge
 *     responses:
 *       200:
 *         description: List of fridge items sorted by expiry date
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FridgeItem'
 *       400:
 *         description: Fridge ID is required
 *       403:
 *         description: Access denied
 */
router.get('/', protect, getItems);

/**
 * @swagger
 * /api/items/stats:
 *   get:
 *     summary: Get fridge item statistics
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics about fridge items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   example: 15
 *                 fresh:
 *                   type: number
 *                   example: 10
 *                 expiring:
 *                   type: number
 *                   example: 3
 *                 expired:
 *                   type: number
 *                   example: 2
 */
router.get('/stats', protect, getStats);

/**
 * @swagger
 * /api/items/expiring:
 *   get:
 *     summary: Get items expiring within N days
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         required: false
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Number of days to check (default 3)
 *     responses:
 *       200:
 *         description: List of expiring items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FridgeItem'
 */
router.get('/expiring', protect, getExpiringItems);

/**
 * @swagger
 * /api/items/by-category:
 *   get:
 *     summary: Get items grouped by category
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fridgeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items grouped by category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 Dairy: [{ name: 'Milk', expiryDate: '2026-04-10' }]
 *                 Fruit: [{ name: 'Apple', expiryDate: '2026-04-05' }]
 */
router.get('/by-category', protect, getItemsByCategory);

/**
 * @swagger
 * /api/items/barcode/{barcode}:
 *   get:
 *     summary: Lookup product info by barcode (OpenFoodFacts)
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *         description: Product barcode (EAN/UPC)
 *         example: '5449000000996'
 *     responses:
 *       200:
 *         description: Product information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 barcode:
 *                   type: string
 *                 name:
 *                   type: string
 *                   example: Coca-Cola
 *                 brand:
 *                   type: string
 *                   example: Coca-Cola Company
 *                 imageUrl:
 *                   type: string
 *                 category:
 *                   type: string
 *                   example: Beverages
 *       404:
 *         description: Product not found in OpenFoodFacts database
 */
router.get('/barcode/:barcode', protect, lookupBarcode);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Get a single item by ID
 *     tags: [Items]
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
 *         description: Item data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FridgeItem'
 *       404:
 *         description: Item not found
 */
router.get('/:id', protect, getItem);

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: Add a new item to fridge
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fridgeId, name, expiryDate]
 *             properties:
 *               fridgeId:
 *                 type: string
 *               name:
 *                 type: string
 *                 example: Milk
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: '2026-04-10'
 *               category:
 *                 type: string
 *                 example: Dairy
 *               quantity:
 *                 type: number
 *                 example: 2
 *               unit:
 *                 type: string
 *                 example: liter
 *               imageUrl:
 *                 type: string
 *                 description: Base64 image or URL
 *               barcode:
 *                 type: string
 *                 example: '5449000000996'
 *     responses:
 *       201:
 *         description: Item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FridgeItem'
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Access denied
 */
router.post('/', protect, createItem);

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     summary: Update an existing item
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FridgeItem'
 *       404:
 *         description: Item not found
 */
router.put('/:id', protect, updateItem);

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     summary: Delete an item from fridge
 *     tags: [Items]
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
 *                 message:
 *                   type: string
 *                   example: Item removed
 *                 id:
 *                   type: string
 *       403:
 *         description: Only owner can delete items
 *       404:
 *         description: Item not found
 */
router.delete('/:id', protect, deleteItem);

/**
 * @swagger
 * /api/items/{id}/consume:
 *   post:
 *     summary: Mark item as consumed (+10 Eco Points)
 *     tags: [Items]
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
 *         description: Item consumed and deleted. Returns updated eco points.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ecoPoints:
 *                   type: number
 *                   example: 160
 *       403:
 *         description: Access denied
 *       404:
 *         description: Item not found
 */
router.post('/:id/consume', protect, consumeItem);

/**
 * @swagger
 * /api/items/{id}/waste:
 *   post:
 *     summary: Mark item as wasted (no eco points)
 *     tags: [Items]
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
 *         description: Item removed as wasted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Item removed
 *                 id:
 *                   type: string
 *       403:
 *         description: Access denied
 *       404:
 *         description: Item not found
 */
router.post('/:id/waste', protect, wasteItem);

module.exports = router;