const ShoppingItem = require('../models/shoppingModel');
const FridgeItem = require('../models/itemModel');
const Fridge = require('../models/fridgeModel');
const { emitToFridge } = require('../socket/socketHandler');

const checkDuplicatesInFridge = async (fridgeId, itemName) => {
    try {
        const fridgeItems = await FridgeItem.find({ fridgeId, status: { $ne: 'expired' } });
        const similar = fridgeItems.filter(item => {
            const similarity = calculateSimilarity(itemName.toLowerCase().trim(), item.name.toLowerCase().trim());
            return similarity > 0.6;
        });
        return similar.map(item => ({
            itemId: item._id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            expiryDate: item.expiryDate
        }));
    } catch (error) {
        return [];
    }
};

const calculateSimilarity = (str1, str2) => {
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(w => words2.includes(w));
    if (commonWords.length > 0) return commonWords.length / Math.max(words1.length, words2.length);
    if (str1.length < 20 && str2.length < 20) {
        const distance = levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return (maxLength - distance) / maxLength;
    }
    return 0;
};

const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
};

const getAll = async (req, res) => {
    try {
        const { fridgeId } = req.query;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });
        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        const items = await ShoppingItem.find({ fridgeId }).populate('addedBy', 'name').sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const create = async (req, res) => {
    try {
        const { fridgeId, text } = req.body;
        if (!fridgeId || !text) return res.status(400).json({ message: 'Required fields missing' });
        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        const similarItems = await checkDuplicatesInFridge(fridgeId, text);
        const item = await ShoppingItem.create({ fridgeId, text, addedBy: req.user._id, similarInFridge: similarItems });
        await item.populate('addedBy', 'name');

        emitToFridge(fridgeId, 'shopping:item_added', { item });

        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const ignoreDuplicate = async (req, res) => {
    try {
        const item = await ShoppingItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const fridge = await Fridge.findById(item.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        item.ignoreDuplicate = true;
        await item.save();
        res.json(item);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const toggle = async (req, res) => {
    try {
        const item = await ShoppingItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const fridge = await Fridge.findById(item.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        item.isCompleted = !item.isCompleted;
        await item.save();

        emitToFridge(item.fridgeId.toString(), 'shopping:item_toggled', { item });

        res.json(item);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const item = await ShoppingItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const fridge = await Fridge.findById(item.fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        const fridgeId = item.fridgeId.toString();
        await item.deleteOne();

        emitToFridge(fridgeId, 'shopping:item_deleted', { id: req.params.id });

        res.json({ id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const moveToFridge = async (req, res) => {
    try {
        const { fridgeId } = req.body;
        if (!fridgeId) return res.status(400).json({ message: 'Fridge ID required' });
        const fridge = await Fridge.findById(fridgeId);
        if (!fridge || !fridge.isMember(req.user._id)) return res.status(403).json({ message: 'Access denied' });
        const completedItems = await ShoppingItem.find({ fridgeId, isCompleted: true });
        if (completedItems.length === 0) return res.json({ message: 'No completed items', movedCount: 0 });
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 7);

        for (const shoppingItem of completedItems) {
            const newItem = await FridgeItem.create({
                fridgeId,
                name: shoppingItem.text,
                expiryDate: defaultExpiry,
                addedBy: req.user._id,
                quantity: 1,
                unit: 'piece',
                category: 'Other'
            });
            await shoppingItem.deleteOne();

            emitToFridge(fridgeId, 'item:added', {
                item: newItem,
                message: `${shoppingItem.text} moved from shopping list to fridge`
            });
        }

        emitToFridge(fridgeId, 'shopping:moved_to_fridge', {
            movedCount: completedItems.length,
            message: `${completedItems.length} items moved to fridge`
        });

        res.json({ message: 'Items moved to fridge', movedCount: completedItems.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAll, create, toggle, deleteItem, ignoreDuplicate, moveToFridge };