const notificationI18n = {
    EN: {
        expiryTitle: "⚠️ Food Expiring Soon!",
        expiryBody: (count, itemText) =>
            `You have ${count} item(s) expiring today or tomorrow: ${itemText}. Eat them soon!`,
        andMore: (n) => `and ${n} more`,
        weeklyTitle: "📊 Weekly Fridge Report",
        weeklyBody: (fresh, expiring, expired) =>
            `${fresh} fresh, ${expiring} expiring, ${expired} expired. Keep ${expiring} items from going bad!`,
        newFoodTitle: (city) => `New Food in ${city}! 🥗`,
        newFoodBody: (userName, itemName) => `${userName} is sharing "${itemName}". Check it out!`,
        newRequestTitle: "New Request! 🎁",
        newRequestBody: (userName, itemName) => `${userName} wants your "${itemName}". Open app to reply!`,
    },
    RU: {
        expiryTitle: "⚠️ Продукты скоро истекут!",
        expiryBody: (count, itemText) =>
            `${count} продукт(ов) истекает сегодня или завтра: ${itemText}. Съешьте их скорее!`,
        andMore: (n) => `и ещё ${n}`,
        weeklyTitle: "📊 Еженедельный отчёт",
        weeklyBody: (fresh, expiring, expired) =>
            `${fresh} свежих, ${expiring} истекает, ${expired} просрочено. Не дайте ${expiring} продуктам испортиться!`,
        newFoodTitle: (city) => `Новая еда в ${city}! 🥗`,
        newFoodBody: (userName, itemName) => `${userName} делится "${itemName}". Посмотрите!`,
        newRequestTitle: "Новый запрос! 🎁",
        newRequestBody: (userName, itemName) => `${userName} хочет забрать "${itemName}". Откройте приложение!`,
    },
    KZ: {
        expiryTitle: "⚠️ Өнімдердің мерзімі аяқталуда!",
        expiryBody: (count, itemText) =>
            `${count} өнімнің мерзімі бүгін немесе ертең аяқталады: ${itemText}. Тезірек жеңіз!`,
        andMore: (n) => `және тағы ${n}`,
        weeklyTitle: "📊 Апталық есеп",
        weeklyBody: (fresh, expiring, expired) =>
            `${fresh} жаңа, ${expiring} мерзімі аяқталуда, ${expired} мерзімі өткен. ${expiring} өнімді бұзылмай тұрып жеңіз!`,
        newFoodTitle: (city) => `${city} қаласында жаңа тамақ! 🥗`,
        newFoodBody: (userName, itemName) => `${userName} "${itemName}" бөлісуде. Қараңыз!`,
        newRequestTitle: "Жаңа сұраныс! 🎁",
        newRequestBody: (userName, itemName) => `${userName} сіздің "${itemName}" алғысы келеді. Қолданбаны ашыңыз!`,
    }
};

module.exports = notificationI18n;