const { Expo } = require('expo-server-sdk');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const expo = new Expo();

const sendNotification = async (userId, title, body, data = {}, type = 'system') => {
    try {

        let finalType = type;
        if (data && data.type) {
            finalType = data.type;
        };

        const user = await User.findById(userId);
        if (!user) return;

        const hasNotificationsEnabled = !!(user.pushToken && Expo.isExpoPushToken(user.pushToken));

        if (!hasNotificationsEnabled) return;

        await Notification.create({
            userId,
            title,
            message: body,
            data,
            type: finalType
        });

        const messages = [{
            to: user.pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data,
        }];

        await expo.sendPushNotificationsAsync(messages);
        console.log(`[Push] Sent to ${userId} (Type: ${finalType})`);

    } catch (error) {
        console.error('Notification Error:', error);
    }
};

module.exports = sendNotification;