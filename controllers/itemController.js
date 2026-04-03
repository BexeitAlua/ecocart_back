const FridgeItem = require('../models/itemModel');
const Fridge = require('../models/fridgeModel');
const User = require('../models/userModel');
const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const { emitToFridge } = require('../socket/socketHandler');

const checkFridgeAccess = async (fridgeId, userId) => {
    const fridge = await Fridge.findById(fridgeId);
    if (!fridge) throw new Error('Fridge not found');
    if (!fridge.isMember(userId)) throw new Error('Access denied');
    return fridge;
};

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
        res.status(500).json({ message: 'Failed to lookup product', error: error.message });
    }
};

const createItem = async (req, res) => {
    try {
        let { fridgeId, imageUrl, ...itemData } = req.body;
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
            } catch {
                imageUrl = '';
            }
        }
        const item = await FridgeItem.create({ ...itemData, imageUrl, fridgeId, addedBy: req.user._id });
        item.calculateStatus();
        await item.save();
        await item.populate('addedBy', 'name');

        emitToFridge(fridgeId, 'item:added', {
            item,
            addedBy: req.user._id,
            message: `${req.user.name} added ${item.name}`
        });

        res.status(201).json(item);
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        res.status(400).json({ message: error.message });
    }
};

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
            } catch {
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
        res.status(400).json({ message: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const fridge = await checkFridgeAccess(item.fridgeId, req.user._id);
        if (!fridge.isOwner(req.user._id) && !fridge.settings?.allowMembersToDelete) {
            return res.status(403).json({ message: 'Only owner can delete items' });
        }
        const fridgeId = item.fridgeId.toString();
        const itemId = item._id.toString();
        await item.deleteOne();

        emitToFridge(fridgeId, 'item:deleted', { itemId });

        res.json({ message: 'Item removed', id: itemId });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const consumeItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);
        const fridgeId = item.fridgeId.toString();
        const itemName = item.name;
        await item.deleteOne();
        await User.findByIdAndUpdate(req.user._id, { $inc: { ecoPoints: 10 } });
        const user = await User.findById(req.user._id);

        emitToFridge(fridgeId, 'item:consumed', {
            itemName,
            consumedBy: req.user._id,
            ecoPoints: user.ecoPoints,
            message: `${user.name} consumed ${itemName} 🌱`
        });

        res.json({ ecoPoints: user.ecoPoints });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const wasteItem = async (req, res) => {
    try {
        const item = await FridgeItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        await checkFridgeAccess(item.fridgeId, req.user._id);
        const fridgeId = item.fridgeId.toString();
        const itemId = item._id.toString();
        await item.deleteOne();

        emitToFridge(fridgeId, 'item:wasted', { itemId });

        res.json({ message: 'Item removed', id: itemId });
    } catch (error) {
        if (error.message === 'Fridge not found') return res.status(404).json({ message: error.message });
        if (error.message === 'Access denied') return res.status(403).json({ message: error.message });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getItems, getItem, lookupBarcode, createItem, updateItem,
    deleteItem, consumeItem, wasteItem, getExpiringItems, getItemsByCategory, getStats
};