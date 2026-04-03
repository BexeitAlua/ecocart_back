const { Expo } = require('expo-server-sdk');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const expo = new Expo();

/**
 * 发送通知并保存到数据库
 */
const sendNotification = async (userId, title, body, data = {}, type = 'system') => {
    try {
        // 🛠️ 修复逻辑：优先从 data 中获取 type
        // 如果调用时写成了 send(..., { type: 'expiry' })，这里能自动纠正
        let finalType = type;
        if (data && data.type) {
            finalType = data.type;
        }

        // 1. 保存到数据库
        await Notification.create({
            userId,
            title,
            message: body,
            data,
            type: finalType // 使用修正后的类型
        });

        // 2. 查找用户的 Push Token 并发送
        const user = await User.findById(userId);

        // 如果用户没开通知，或者没Token，只存数据库，不发Push
        if (!user || !user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
            return;
        }

        const messages = [{
            to: user.pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data, // Expo payload
        }];

        await expo.sendPushNotificationsAsync(messages);
        console.log(`[Push] Sent to ${userId} (Type: ${finalType})`);

    } catch (error) {
        console.error('Notification Error:', error);
    }
};

module.exports = sendNotification;