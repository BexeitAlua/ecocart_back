require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Fridge = require('../models/fridgeModel');

const migrateToSharedFridges = async () => {
    try {
        const dbUri = 'mongodb://127.0.0.1:27017/contacts';
        await mongoose.connect(dbUri);
        console.log('Connected to local database:', dbUri);

        const users = await User.find({});
        console.log(`\n Found ${users.length} users to process`);

        for (const user of users) {
            console.log(`\n Processing user: ${user.name} (${user.email})`);

            let fridge = await Fridge.findOne({ ownerId: user._id });

            if (!fridge) {
                fridge = await Fridge.create({
                    name: `${user.name}'s Fridge`,
                    emoji: '🧊',
                    ownerId: user._id,
                    members: [{
                        userId: user._id,
                        role: 'owner'
                    }]
                });

                fridge.generateInviteCode();
                await fridge.save();

                console.log(`  Created fridge: "${fridge.name}" (ID: ${fridge._id})`);
                console.log(`  Invite code: ${fridge.inviteCode}`);
            } else {
                console.log(`  ℹFridge already exists: "${fridge.name}"`);
            }

            const FridgeItem = mongoose.connection.db.collection('fridgeitems');

            const oldItemsCount = await FridgeItem.countDocuments({ userId: user._id });

            if (oldItemsCount > 0) {
                console.log(`  Found ${oldItemsCount} items to migrate`);

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

                console.log(`  Migrated ${result.modifiedCount} items to fridge`);
            } else {
                console.log(`  ℹ No items to migrate`);
            }
        }

        console.log('\n\n🎉 ===== MIGRATION COMPLETED SUCCESSFULLY =====');
        console.log('\nSummary:');
        console.log(`   - Processed ${users.length} users`);
        console.log(`   - Created/verified fridges`);
        console.log(`   - Migrated all items from userId to fridgeId`);
        console.log('\n Next steps:');
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

migrateToSharedFridges();