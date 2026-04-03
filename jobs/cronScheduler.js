// backend/jobs/cronScheduler.js
const cron = require('node-cron');
const FridgeItem = require('../models/itemModel');
const User = require('../models/userModel');
const sendPushNotification = require('../utils/pushSender');

// 每天早上 9:00 (根据服务器时间，如果是UTC需调整) 执行
const initCronJobs = () => {

    // 1. ⏰ 过期提醒 (每天运行)
    cron.schedule('46 23 * * *', async () => {
        console.log('Running Expiry Check Job...');

        try {
            // 找到明天或者今天过期的物品
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(23, 59, 59, 999);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 查找所有快过期的物品，并关联用户信息
            // 注意：这里需要通过 fridgeId -> 找到 members -> 找到 User 的 token
            // 为了简化，假设 item.addedBy 就是主要接收者 (实际项目中应通知整个冰箱成员)
            const expiringItems = await FridgeItem.find({
                expiryDate: { $gte: today, $lte: tomorrow },
                status: { $ne: 'consumed' } // 假设 consumed 是已吃掉
            }).populate('addedBy');

            // 汇总每个用户的过期物品
            const userAlerts = {};

            expiringItems.forEach(item => {
                const user = item.addedBy;
                if (!user) return;

                if (!userAlerts[user._id]) {
                    // 我们不需要在这里存 token 了，只存 ID 即可，pushSender 会自己查
                    userAlerts[user._id] = { items: [] };
                }
                userAlerts[user._id].items.push(item.name);
            });

            // 发送通知
            for (const userId in userAlerts) {
                const { items } = userAlerts[userId];
                const count = items.length;
                const itemText = items.slice(0, 2).join(', ') + (count > 2 ? '...' : '');

                // 这里调用 sendNotification，它会：
                // 1. 存入 MongoDB (App 内铃铛会有红点)
                // 2. 检查是否有 Token -> 有则推送到手机，无则跳过
                await sendPushNotification(
                    userId,
                    "⚠️ Food Expiring Soon!",
                    `You have ${count} items expiring (including ${itemText}). Eat them soon!`,
                    { type: 'expiry' }
                );
            }
        } catch (error) {
            console.error('Cron Job Error:', error);
        }
    });

    // 2. 📊 每周总结 (每周日晚上 20:00)
    cron.schedule('0 20 * * 0', async () => {
        console.log('Running Weekly Summary...');

        try {
            const users = await User.find({}, '_id');

            for (const user of users) {
                // 1. 统计该用户的所有物品状态
                // 注意：这里简单通过 addedBy 统计，实际项目可能需要查 Fridge Member 关系
                const items = await FridgeItem.find({ addedBy: user._id });

                let fresh = 0;
                let expiring = 0;
                let expired = 0;

                items.forEach(item => {
                    // 重新计算一下状态，确保准确
                    const status = item.calculateStatus();
                    if (status === 'fresh') fresh++;
                    else if (status === 'expiring') expiring++;
                    else if (status === 'expired') expired++;
                });

                // 2. 如果冰箱是空的，就不发周报了，或者发一个“去填满冰箱”的提示
                if (items.length === 0) continue;

                // 3. 构建数据 Payload
                const statsData = {
                    total: items.length,
                    fresh,
                    expiring,
                    expired,
                    score: fresh * 10 - expired * 5 // 简单算个分
                };

                // 4. 发送通知 (把 statsData 塞进 data 字段)
                await sendPushNotification(
                    user._id,
                    "Weekly Fridge Report 📊",
                    `You have ${fresh} fresh items and ${expired} expired items. Click to see details!`,
                    {
                        type: 'report', // 🆕 新类型
                        stats: statsData // 🆕 携带数据
                    }
                );
            }
            console.log(`Weekly summary sent.`);
        } catch (error) {
            console.error('Weekly Summary Error:', error);
        }
    });
};

module.exports = initCronJobs;