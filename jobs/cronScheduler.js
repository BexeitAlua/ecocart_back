const cron = require('node-cron');
const FridgeItem = require('../models/itemModel');
const User = require('../models/userModel');
const sendPushNotification = require('../utils/pushSender');
const notificationI18n = require('../utils/notificationI18n');

const log = {
    info: (msg) => console.log(`[CRON] ℹ️  ${msg}`),
    error: (msg) => console.error(`[CRON] ❌ ${msg}`),
    success: (msg) => console.log(`[CRON] ✅ ${msg}`)
};

const initCronJobs = () => {

    cron.schedule('0 9 * * *', async () => {
        log.info('Starting Expiry Check Job...');

        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(23, 59, 59, 999);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiringItems = await FridgeItem.find({
                expiryDate: { $gte: today, $lte: tomorrow },
                status: { $nin: ['consumed', 'expired'] }
            }).populate('addedBy', 'name language');

            if (expiringItems.length === 0) {
                log.info('No expiring items found.');
                return;
            }

            log.info(`Found ${expiringItems.length} expiring items`);

            const userAlerts = {};

            expiringItems.forEach(item => {
                const user = item.addedBy;
                if (!user) return;

                if (!userAlerts[user._id]) {
                    userAlerts[user._id] = {
                        userId: user._id,
                        userName: user.name,
                        language: user.language || 'EN',
                        items: []
                    };
                }
                userAlerts[user._id].items.push({
                    name: item.name,
                    expiryDate: item.expiryDate,
                    category: item.category
                });
            });

            let notificationsSent = 0;
            for (const userId in userAlerts) {
                try {
                    const { userName, items, language } = userAlerts[userId];
                    const i18n = notificationI18n[language] || notificationI18n['EN'];
                    const count = items.length;

                    const itemText = items
                        .slice(0, 2)
                        .map(i => i.name)
                        .join(', ') + (count > 2 ? ` ${i18n.andMore(count - 2)}` : '');

                    await sendPushNotification(
                        userId,
                        i18n.expiryTitle,
                        i18n.expiryBody(count, itemText),
                        {
                            type: 'expiry',
                            itemCount: count,
                            items: items.map(i => ({ name: i.name, expiry: i.expiryDate }))
                        }
                    );

                    notificationsSent++;
                    log.info(`Sent expiry notification to user ${userId} (${userName})`);
                } catch (notifError) {
                    log.error(`Failed to send notification to user ${userId}: ${notifError.message}`);
                }
            }

            log.success(`Expiry check completed. Sent ${notificationsSent} notifications.`);

        } catch (error) {
            log.error(`Expiry check job failed: ${error.message}`);
            console.error(error.stack);

        }
    });

    cron.schedule('0 20 * * 0', async () => {
        log.info('Starting Weekly Summary...');

        try {
            const users = await User.find({}, '_id name language');

            if (users.length === 0) {
                log.info('No users found for weekly summary.');
                return;
            }

            log.info(`Processing weekly summary for ${users.length} users`);

            let summariesSent = 0;

            for (const user of users) {
                try {
                    const items = await FridgeItem.find({ addedBy: user._id });

                    if (items.length === 0) {
                        continue;
                    }

                    let fresh = 0, expiring = 0, expired = 0;

                    items.forEach(item => {
                        const status = item.calculateStatus();
                        if (status === 'fresh') fresh++;
                        else if (status === 'expiring') expiring++;
                        else if (status === 'expired') expired++;
                    });

                    const statsData = {
                        total: items.length,
                        fresh,
                        expiring,
                        expired,
                        efficiency: fresh > 0 ? Math.round((fresh / items.length) * 100) : 0
                    };

                    const i18n = notificationI18n[user.language] || notificationI18n['EN'];

                    await sendPushNotification(
                        user._id,
                        i18n.weeklyTitle,
                        i18n.weeklyBody(fresh, expiring, expired),
                        {
                            type: 'report',
                            stats: statsData
                        }
                    );

                    summariesSent++;
                    log.info(`Sent weekly summary to user ${user._id}`);

                } catch (userError) {
                    log.error(`Failed to process summary for user ${user._id}: ${userError.message}`);
                }
            }

            log.success(`Weekly summary completed. Sent ${summariesSent} reports.`);

        } catch (error) {
            log.error(`Weekly summary job failed: ${error.message}`);
            console.error(error.stack);
        }
    });

    cron.schedule('0 3 * * *', async () => {
        log.info('Starting automatic expiry marking job...');

        try {
            const now = new Date();

            const result = await FridgeItem.updateMany(
                {
                    expiryDate: { $lt: now },
                    status: { $ne: 'expired' }
                },
                {
                    $set: { status: 'expired' }
                }
            );

            log.success(`Marked ${result.modifiedCount} items as expired.`);

        } catch (error) {
            log.error(`Expiry marking job failed: ${error.message}`);
        }
    });

    log.success('All cron jobs initialized successfully!');
};

module.exports = initCronJobs;