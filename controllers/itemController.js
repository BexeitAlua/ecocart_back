const FridgeItem = require('../models/itemModel');
const Fridge = require('../models/fridgeModel');
const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const User = require('../models/userModel');
const { emitToFridge } = require('../socket/socketHandler');
const logger = require('../config/logger');

const CO2_FACTORS = {
    'Meat': 5.0,
    'Dairy': 1.5,
    'Cooked': 1.0,
    'Bakery': 0.8,
    'Fruit': 0.3,
    'Vegetables': 0.3,
    'Beverages': 0.5,
    'Snacks': 0.5,
    'Canned': 0.8,
    'Other': 0.5
};

const checkFridgeAccess = async (fridgeId, userId) => {
    const fridge = await Fridge.findById(fridgeId);
    if (!fridge) throw new Error('Fridge not found');
    if (!fridge.isMember(userId)) throw new Error('Access denied');
    return fridge;
};

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
 *     responses:
 *       200:
 *         description: List of fridge items
 */
const getItems = async (req, res) => {
    try {
        const { fridgeId } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID is required' });
        await checkFridgeAccess(fridgeId, req.user._id);
        const items = await FridgeItem.find({ fridgeId }).populate('addedBy', 'name').sort({ expiryDate: 1 });
        items.forEach(item => item.calculateStatus());
        res.json(items);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`getItems error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Get single item
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
 */
const getItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id).populate('addedBy', 'name');
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);
        item.calculateStatus();
        res.json(item);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`getItem error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const categorizeProduct = (tags) => {
    if (!tags || tags.length === 0) return 'Other';
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('dairy') || tagString.includes('milk') || tagString.includes('cheese')) return 'Dairy';
    if (tagString.includes('fruit')) return 'Fruit';
    if (tagString.includes('vegetable')) return 'Vegetables';
    if (tagString.includes('meat') || tagString.includes('poultry') || tagString.includes('fish')) return 'Meat';
    if (tagString.includes('beverage') || tagString.includes('drink')) return 'Beverages';
    if (tagString.includes('snack')) return 'Snacks';
    return 'Other';
};

/**
 * @swagger
 * /api/items/barcode/{barcode}:
 *   get:
 *     summary: Lookup product by barcode
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product info from OpenFoodFacts
 *       404:
 *         description: Product not found
 */
const lookupBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        if (response.data.status === 0) return res.status(404).json({ message: 'Product not found', barcode });
        const product = response.data.product;
        res.json({
            barcode,
            name: product.product_name || 'Unknown Product',
            brand: product.brands || '',
            imageUrl: product.image_url || product.image_front_url || '',
            category: categorizeProduct(product.categories_tags || []),
            suggestedCategory: categorizeProduct(product.categories_tags || [])
        });
    } catch (error) {
        logger.error(`lookupBarcode error: ${error.message}`);
        res.status(500).json({ message: 'Failed to lookup product', error: error.message });
    }
};

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: Add new item to fridge
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
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unit:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Item created
 */
const createItem = async (req, res) => {
    try {
        let { fridgeId, imageUrl, price, ...itemData } = req.body;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID is required' });
        await checkFridgeAccess(fridgeId, req.user._id);

        if (imageUrl && imageUrl.startsWith('data:image')) {
            try {
                const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
                    folder: 'ecocart_items',
                    resource_type: 'image',
                    transformation: [{ width: 500, height: 500, crop: 'limit' }]
                });
                imageUrl = uploadResponse.secure_url;
            } catch (uploadError) {
                logger.error(`Cloudinary upload error: ${uploadError.message}`);
                imageUrl = '';
            }
        }

        const item = await FridgeItem.create({
            ...itemData,
            price: price || 0,
            imageUrl,
            fridgeId,
            addedBy: req.user._id
        });

        item.calculateStatus();
        await item.save();
        await item.populate('addedBy', 'name');

        emitToFridge(fridgeId, 'item:added', {
            item,
            addedBy: req.user._id,
            message: `${req.user.name} added ${item.name}`
        });

        logger.info(`Item created: ${item.name} in fridge ${fridgeId}`);
        res.status(201).json(item);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`createItem error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     summary: Update item
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
 *         description: Item updated
 */
const updateItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);

        let { imageUrl, ...updates } = req.body;
        if (imageUrl && imageUrl.startsWith('data:image')) {
            try {
                const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
                    folder: 'ecocart_items',
                    resource_type: 'image',
                    transformation: [{ width: 500, height: 500, crop: 'limit' }]
                });
                imageUrl = uploadResponse.secure_url;
            } catch (uploadError) {
                logger.error(`Cloudinary upload error: ${uploadError.message}`);
                imageUrl = item.imageUrl;
            }
        }

        const dataToUpdate = { ...updates };
        if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;

        Object.assign(item, dataToUpdate);
        item.calculateStatus();
        await item.save();
        await item.populate('addedBy', 'name');

        emitToFridge(item.fridgeId.toString(), 'item:updated', { item });

        res.json(item);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`updateItem error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     summary: Delete item
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
 */
const deleteItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const fridge = await checkFridgeAccess(item.fridgeId, req.user._id);
        if (!fridge.isOwner(req.user._id) && !fridge.settings.allowMembersToDelete) {
            return res.status(403).json({ message: 'Only owner can delete items' });
        }
        const fridgeId = item.fridgeId.toString();
        const itemId = item._id.toString();
        await item.deleteOne();

        emitToFridge(fridgeId, 'item:deleted', { itemId });

        logger.info(`Item deleted: ${itemId} from fridge ${fridgeId}`);
        res.json({ message: 'Item removed', id: itemId });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`deleteItem error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * @swagger
 * /api/items/expiring:
 *   get:
 *     summary: Get expiring items
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
 *         schema:
 *           type: integer
 *           default: 3
 *     responses:
 *       200:
 *         description: List of expiring items
 */
const getExpiringItems = async (req, res) => {
    try {
        const { fridgeId } = req.query;
        const days = parseInt(req.query.days) || 3;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID is required' });
        await checkFridgeAccess(fridgeId, req.user._id);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        const items = await FridgeItem.find({
            fridgeId,
            expiryDate: { $lte: targetDate },
            status: { $ne: 'expired' }
        }).populate('addedBy', 'name').sort({ expiryDate: 1 });
        items.forEach(item => item.calculateStatus());
        res.json(items);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`getExpiringItems error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
 */
const getItemsByCategory = async (req, res) => {
    try {
        const { fridgeId } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID is required' });
        await checkFridgeAccess(fridgeId, req.user._id);
        const items = await FridgeItem.find({ fridgeId }).populate('addedBy', 'name');
        const grouped = items.reduce((acc, item) => {
            item.calculateStatus();
            const cat = item.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
        res.json(grouped);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`getItemsByCategory error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * @swagger
 * /api/items/stats:
 *   get:
 *     summary: Get fridge statistics
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
 *         description: Stats with total, fresh, expiring, expired counts
 */
const getStats = async (req, res) => {
    try {
        const { fridgeId } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID is required' });
        await checkFridgeAccess(fridgeId, req.user._id);
        const items = await FridgeItem.find({ fridgeId });
        let fresh = 0, expiring = 0, expired = 0;
        items.forEach(item => {
            const status = item.calculateStatus();
            if (status === 'fresh') fresh++;
            else if (status === 'expiring') expiring++;
            else expired++;
        });
        res.json({ total: items.length, fresh, expiring, expired });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`getStats error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
 *         description: Item consumed, returns ecoPoints, moneySaved, co2Saved
 */
const consumeItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.efficiencyStats) {
            user.efficiencyStats = { itemsConsumed: 0, itemsWasted: 0, totalMoneySaved: 0, totalCo2Saved: 0 };
        }

        // ✅ Объявляем itemName и fridgeId ДО удаления item
        const itemName = item.name;
        const fridgeId = item.fridgeId.toString();

        const pointsEarned = 10;
        user.ecoPoints += pointsEarned;
        user.efficiencyStats.itemsConsumed += 1;

        const moneySaved = item.price > 0 ? item.price : 500;
        user.efficiencyStats.totalMoneySaved = (user.efficiencyStats.totalMoneySaved || 0) + moneySaved;

        const co2Factor = CO2_FACTORS[item.category] || 0.5;
        const co2Saved = item.quantity * co2Factor;
        user.efficiencyStats.totalCo2Saved = (user.efficiencyStats.totalCo2Saved || 0) + co2Saved;

        user.pointsHistory.push({
            points: user.ecoPoints,
            reason: `Consumed ${itemName}`,
            date: new Date()
        });

        await user.save();
        await item.deleteOne();

        emitToFridge(fridgeId, 'item:consumed', {
            itemName,
            consumedBy: req.user._id,
            ecoPoints: user.ecoPoints,
            message: `${user.name} consumed ${itemName} 🌱`
        });

        logger.info(`Item consumed: ${itemName} by user ${req.user._id}`);
        res.json({ message: 'Item consumed', ecoPoints: user.ecoPoints, moneySaved, co2Saved });
    } catch (error) {
        logger.error(`consumeItem error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

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
 *         description: Item removed as waste
 */
const wasteItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const co2Factor = CO2_FACTORS[item.category] || 0.5;
        const co2Wasted = item.quantity * co2Factor;
        const moneyWasted = item.price > 0 ? item.price : 0;

        if (!user.efficiencyStats) user.efficiencyStats = { itemsConsumed: 0, itemsWasted: 0 };
        user.efficiencyStats.itemsWasted += 1;

        user.pointsHistory.push({
            points: user.ecoPoints,
            reason: `Wasted ${item.name}`,
            date: new Date()
        });

        await user.save();

        const fridgeId = item.fridgeId.toString();
        const itemId = item._id.toString();
        await item.deleteOne();

        emitToFridge(fridgeId, 'item:wasted', { itemId });

        logger.info(`Item wasted: ${item.name} by user ${req.user._id}`);
        res.json({
            message: 'Item discarded as waste',
            wasteCount: user.efficiencyStats.itemsWasted,
            ecoPoints: user.ecoPoints,
            co2Wasted: Math.round(co2Wasted * 100) / 100,
            moneyWasted
        });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        logger.error(`wasteItem error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @swagger
 * /api/items/batch:
 *   post:
 *     summary: Add multiple items at once (from receipt scan)
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fridgeId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Items batch created
 */
const createManyItems = async (req, res) => {
    try {
        const { fridgeId, items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'No items provided' });
        }
        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) {
            return res.status(403).json({ message: 'Access denied to this fridge' });
        }
        const itemsToInsert = items.map(item => ({
            ...item,
            fridgeId,
            addedBy: req.user._id,
            expiryDate: item.expiryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'fresh'
        }));
        const result = await FridgeItem.insertMany(itemsToInsert);

        emitToFridge(fridgeId, 'items:batch_added', {
            count: result.length,
            message: `${result.length} items added from receipt scan`
        });

        logger.info(`Batch created: ${result.length} items in fridge ${fridgeId}`);
        res.status(201).json({ message: `Successfully added ${result.length} items`, count: result.length });
    } catch (error) {
        logger.error(`createManyItems error: ${error.message}`);
        res.status(500).json({ message: 'Server error during batch upload' });
    }
};

module.exports = {
    getItems, getItem, lookupBarcode, createItem, updateItem,
    deleteItem, getExpiringItems, getItemsByCategory, getStats,
    consumeItem, wasteItem, createManyItems
};