// Place this file in: backend/scripts/migrateToSharedFridges.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Fridge = require('../models/fridgeModel');

const migrateToSharedFridges = async () => {
    try {
        // Connect to LOCAL database (same as your server)
        const dbUri = 'mongodb://127.0.0.1:27017/contacts';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to local database:', dbUri);

        // Get all users
        const users = await User.find({});
        console.log(`\n📊 Found ${users.length} users to process`);

        for (const user of users) {
            console.log(`\n👤 Processing user: ${user.name} (${user.email})`);

            // Check if user already has a fridge
            let fridge = await Fridge.findOne({ ownerId: user._id });

            if (!fridge) {
                // Create default fridge for user
                fridge = await Fridge.create({
                    name: `${user.name}'s Fridge`,
                    emoji: '🧊',
                    ownerId: user._id,
                    members: [{
                        userId: user._id,
                        role: 'owner'
                    }]
                });

                // Generate invite code
                fridge.generateInviteCode();
                await fridge.save();

                console.log(`  ✅ Created fridge: "${fridge.name}" (ID: ${fridge._id})`);
                console.log(`  🔑 Invite code: ${fridge.inviteCode}`);
            } else {
                console.log(`  ℹ️  Fridge already exists: "${fridge.name}"`);
            }

            // Migrate items from userId to fridgeId
            const FridgeItem = mongoose.connection.db.collection('fridgeitems');

            // Count items to migrate
            const oldItemsCount = await FridgeItem.countDocuments({ userId: user._id });

            if (oldItemsCount > 0) {
                console.log(`  📦 Found ${oldItemsCount} items to migrate`);

                // Update all user's items to use fridgeId
                const result = await FridgeItem.updateMany(
                    { userId: user._id },
                    {
                        $set: {
                            fridgeId: fridge._id,
                            addedBy: user._id
                        },
                        $unset: { userId: "" }
                    }
                );

                console.log(`  ✅ Migrated ${result.modifiedCount} items to fridge`);
            } else {
                console.log(`  ℹ️  No items to migrate`);
            }
        }

        console.log('\n\n🎉 ===== MIGRATION COMPLETED SUCCESSFULLY =====');
        console.log('\n📋 Summary:');
        console.log(`   - Processed ${users.length} users`);
        console.log(`   - Created/verified fridges`);
        console.log(`   - Migrated all items from userId to fridgeId`);
        console.log('\n💡 Next steps:');
        console.log('   1. Update your frontend to use fridgeId');
        console.log('   2. Test the fridge sharing features');
        console.log('   3. Restart your backend server\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
};

// Run migration
migrateToSharedFridges();