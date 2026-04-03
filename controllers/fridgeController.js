const Fridge = require('../models/fridgeModel');


const getUserFridges = async (req, res) => {
    try {
        const fridges = await Fridge.find({
            'members.userId': req.user._id
        })
            .populate('ownerId', 'name email')
            .populate('members.userId', 'name email')
            .sort({ createdAt: -1 });

        res.json(fridges);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id)
            .populate('ownerId', 'name email')
            .populate('members.userId', 'name email');

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        if (!fridge.isMember(req.user._id)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(fridge);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create new fridge
const createFridge = async (req, res) => {
    try {
        const { name, emoji } = req.body;

        const fridge = await Fridge.create({
            name: name || 'My Fridge',
            emoji: emoji || '🧊',
            ownerId: req.user._id,
            members: [{
                userId: req.user._id,
                role: 'owner'
            }]
        });

        // Generate invite code
        fridge.generateInviteCode();
        await fridge.save();

        await fridge.populate('ownerId', 'name email');
        await fridge.populate('members.userId', 'name email');

        res.status(201).json(fridge);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update fridge
const updateFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        // Only owner can update
        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can update fridge' });
        }

        const { name, emoji, settings } = req.body;

        if (name) fridge.name = name;
        if (emoji) fridge.emoji = emoji;
        if (settings) fridge.settings = { ...fridge.settings, ...settings };

        await fridge.save();
        await fridge.populate('ownerId', 'name email');
        await fridge.populate('members.userId', 'name email');

        res.json(fridge);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete fridge
const deleteFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        // Only owner can delete
        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can delete fridge' });
        }

        // Delete all items in this fridge
        const FridgeItem = require('../models/itemModel');
        await FridgeItem.deleteMany({ fridgeId: req.params.id });

        await fridge.deleteOne();

        res.json({ message: 'Fridge and all items deleted', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Generate new invite code
const generateInviteCode = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        // Only owner can generate codes
        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can generate invite codes' });
        }

        fridge.generateInviteCode();
        await fridge.save();

        res.json({
            inviteCode: fridge.inviteCode,
            message: 'New invite code generated'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Join fridge via invite code
const joinFridge = async (req, res) => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode) {
            return res.status(400).json({ message: 'Invite code is required' });
        }

        const fridge = await Fridge.findOne({
            inviteCode: inviteCode.toUpperCase()
        })
            .populate('ownerId', 'name email')
            .populate('members.userId', 'name email');

        if (!fridge) {
            return res.status(404).json({ message: 'Invalid invite code' });
        }

        // Check if already a member
        if (fridge.isMember(req.user._id)) {
            return res.status(400).json({ message: 'You are already a member of this fridge' });
        }

        // Add user as member
        fridge.addMember(req.user._id);
        await fridge.save();

        // Populate the new member's info
        await fridge.populate('members.userId', 'name email');

        res.json({
            message: 'Successfully joined fridge',
            fridge
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Leave fridge
const leaveFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        // Owner cannot leave
        if (fridge.isOwner(req.user._id)) {
            return res.status(400).json({
                message: 'Owner cannot leave fridge. Delete fridge or transfer ownership first.'
            });
        }

        // Remove member
        fridge.removeMember(req.user._id);
        await fridge.save();

        res.json({ message: 'Left fridge successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Remove member (owner only)
const removeMember = async (req, res) => {
    try {
        const { memberId } = req.params;
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        // Only owner can remove members
        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can remove members' });
        }

        // Cannot remove owner
        if (fridge.isOwner(memberId)) {
            return res.status(400).json({ message: 'Cannot remove owner' });
        }

        fridge.removeMember(memberId);
        await fridge.save();

        await fridge.populate('members.userId', 'name email');

        res.json({
            message: 'Member removed',
            fridge
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getUserFridges,
    getFridge,
    createFridge,
    updateFridge,
    deleteFridge,
    generateInviteCode,
    joinFridge,
    leaveFridge,
    removeMember
};