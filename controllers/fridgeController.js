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

        fridge.generateInviteCode();
        await fridge.save();

        await fridge.populate('ownerId', 'name email');
        await fridge.populate('members.userId', 'name email');

        res.status(201).json(fridge);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

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

const deleteFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can delete fridge' });
        }

        const FridgeItem = require('../models/itemModel');
        await FridgeItem.deleteMany({ fridgeId: req.params.id });

        await fridge.deleteOne();

        res.json({ message: 'Fridge and all items deleted', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const generateInviteCode = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

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

        if (fridge.isMember(req.user._id)) {
            return res.status(400).json({ message: 'You are already a member of this fridge' });
        }

        fridge.addMember(req.user._id);
        await fridge.save();

        await fridge.populate('members.userId', 'name email');

        res.json({
            message: 'Successfully joined fridge',
            fridge
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const leaveFridge = async (req, res) => {
    try {
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        if (fridge.isOwner(req.user._id)) {
            return res.status(400).json({
                message: 'Owner cannot leave fridge. Delete fridge or transfer ownership first.'
            });
        }

        fridge.removeMember(req.user._id);
        await fridge.save();

        res.json({ message: 'Left fridge successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removeMember = async (req, res) => {
    try {
        const { memberId } = req.params;
        const fridge = await Fridge.findById(req.params.id);

        if (!fridge) {
            return res.status(404).json({ message: 'Fridge not found' });
        }

        if (!fridge.isOwner(req.user._id)) {
            return res.status(403).json({ message: 'Only owner can remove members' });
        }

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