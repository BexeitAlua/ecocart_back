const mongoose = require('mongoose');
const crypto = require('crypto');

const fridgeSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'My Fridge',
        required: true,
        trim: true
    },

    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['owner', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],

    inviteCode: {
        type: String,
        unique: true,
        sparse: true
    },

    settings: {
        allowMembersToDelete: {
            type: Boolean,
            default: true
        },
        notifyOnExpiry: {
            type: Boolean,
            default: true
        }
    },

    emoji: {
        type: String,
        default: '🧊'
    }
}, {
    timestamps: true
});

fridgeSchema.methods.generateInviteCode = function () {
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    return this.inviteCode;
};

// Check if user is member
fridgeSchema.methods.isMember = function (userId) {
    return this.members.some(member =>
        member.userId.toString() === userId.toString()
    );
};

// Check if user is owner
fridgeSchema.methods.isOwner = function (userId) {
    return this.ownerId.toString() === userId.toString();
};

// Add member
fridgeSchema.methods.addMember = function (userId) {
    if (this.isMember(userId)) {
        throw new Error('User is already a member');
    }

    this.members.push({
        userId,
        role: 'member'
    });
};

// Remove member
fridgeSchema.methods.removeMember = function (userId) {
    if (this.isOwner(userId)) {
        throw new Error('Cannot remove owner from fridge');
    }

    this.members = this.members.filter(
        member => member.userId.toString() !== userId.toString()
    );
};

// Ensure owner is always in members
fridgeSchema.pre('save', function () {
    const ownerInMembers = this.members.some(
        member => member.userId.toString() === this.ownerId.toString()
    );

    if (!ownerInMembers) {
        this.members.push({
            userId: this.ownerId,
            role: 'owner'
        });
    }
});

module.exports = mongoose.model('Fridge', fridgeSchema);