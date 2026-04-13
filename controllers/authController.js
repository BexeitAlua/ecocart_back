const User = require('../models/userModel');
const Fridge = require('../models/fridgeModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validateUserRegistration, validateUserLogin } = require('../validators/userValidator');
const { sendError } = require('../utils/errorHandlder');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const logger = require('../config/logger');

const emailI18n = {
    EN: {
        subject: 'Your EcoCart Password Reset Code',
        greeting: (name) => `Hi <strong>${name}</strong>,`,
        body: 'Your password reset code is:',
        expires: 'This code expires in <strong>10 minutes</strong>.',
        ignore: "If you didn't request this, you can safely ignore this email.",
    },
    RU: {
        subject: 'Код сброса пароля EcoCart',
        greeting: (name) => `Привет, <strong>${name}</strong>!`,
        body: 'Ваш код для сброса пароля:',
        expires: 'Код действителен <strong>10 минут</strong>.',
        ignore: 'Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.',
    },
    KZ: {
        subject: 'EcoCart құпия сөзді қалпына келтіру коды',
        greeting: (name) => `Сәлем, <strong>${name}</strong>!`,
        body: 'Құпия сөзді қалпына келтіру кодыңыз:',
        expires: 'Код <strong>10 минут</strong> ішінде жарамды.',
        ignore: 'Егер сіз бұл сұранысты жібермеген болсаңыз, бұл хатты елемеңіз.',
    }
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const googleLogin = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) return res.status(400).json({ message: 'Google ID Token is required' });

    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = await User.create({ name, email, password: hashedPassword });
            logger.info(`googleLogin: new user registered via Google | email: ${email}`);

            try {
                const fridge = await Fridge.create({
                    name: `${name.split(' ')[0]}'s Fridge`,
                    emoji: '🧊',
                    ownerId: user._id,
                    members: [{ userId: user._id, role: 'owner' }]
                });
                fridge.generateInviteCode();
                await fridge.save();
                logger.info(`googleLogin: default fridge created for Google user ${user._id}`);
            } catch (err) {
                logger.error(`googleLogin: failed to create default fridge for Google user ${user._id}: ${err.message}`);
            }
        } else {
            logger.info(`googleLogin: existing user signed in via Google | email: ${email}`);
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints || 0,
            token: generateToken(user._id),
        });
    } catch (error) {
        logger.error(`googleLogin error: ${error.message}`);
        res.status(401).json({ message: 'Invalid Google Token' });
    }
};

const registerUser = async (req, res) => {
    const { error, value } = validateUserRegistration(req.body);
    if (error) {
        return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please enter all fields.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword });

    if (user) {
        logger.info(`registerUser: new user created | name: ${name}, email: ${email}`);

        try {
            const fridge = await Fridge.create({
                name: `${name}'s Fridge`,
                emoji: '🧊',
                ownerId: user._id,
                members: [{ userId: user._id, role: 'owner' }]
            });
            fridge.generateInviteCode();
            await fridge.save();
            logger.info(`registerUser: default fridge created for user ${user._id}`);
        } catch (fridgeError) {
            logger.error(`registerUser: failed to create default fridge for user ${user._id}: ${fridgeError.message}`);
        }

        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

const loginUser = async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({
        name: { $regex: new RegExp(`^${username}$`, 'i') }
    }).select('+password');

    if (user && (await bcrypt.compare(password, user.password))) {
        logger.info(`loginUser: user ${user._id} logged in | username: ${username}`);
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences,
            city: user.city,
            pointsHistory: user.pointsHistory || [],
            efficiencyStats: user.efficiencyStats || { itemsConsumed: 0, itemsWasted: 0 }
        });
    } else {
        logger.warn(`loginUser: failed login attempt for username: ${username}`);
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { dietaryPreferences, city, name, language } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (dietaryPreferences !== undefined) user.dietaryPreferences = dietaryPreferences;
        if (city !== undefined) user.city = city;
        if (language !== undefined) user.language = language;
        if (name !== undefined && name.trim() !== '') user.name = name.trim();

        await user.save();
        logger.info(`updateProfile: user ${req.user._id} updated profile`);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences,
            city: user.city,
            language: user.language
        });
    } catch (error) {
        logger.error(`updateProfile error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences || [],
            city: user.city || 'Almaty',
            pointsHistory: user.pointsHistory || [],
            efficiencyStats: user.efficiencyStats || { itemsConsumed: 0, itemsWasted: 0 }
        });
    } catch (error) {
        logger.error(`getMe error: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const updatePushToken = async (req, res) => {
    const { pushToken } = req.body;
    try {
        await User.findByIdAndUpdate(req.user._id, { pushToken: pushToken || null });
        logger.debug(`updatePushToken: token ${pushToken ? 'set' : 'cleared'} for user ${req.user._id}`);
        res.json({ message: 'Push token updated' });
    } catch (error) {
        logger.error(`updatePushToken error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const city = currentUser.city || 'Almaty';

        const topUsers = await User.find({ city })
            .select('name ecoPoints city')
            .sort({ ecoPoints: -1 })
            .limit(10);

        const allUsersInCity = await User.find({ city }).sort({ ecoPoints: -1 });
        const myRank = allUsersInCity.findIndex(u => u._id.toString() === req.user._id.toString()) + 1;
        const totalInCity = allUsersInCity.length;

        logger.info(`getLeaderboard: user ${req.user._id} rank ${myRank}/${totalInCity} in ${city}`);

        res.json({
            city,
            topUsers,
            myRank: myRank > 0 ? myRank : '-',
            topPercentage: myRank > 0 ? Math.ceil((myRank / totalInCity) * 100) : 100
        });
    } catch (error) {
        logger.error(`getLeaderboard error: ${error.message}`);
        res.status(500).json({ message: 'Server Error' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        user.resetPasswordOTP = await bcrypt.hash(otp, 10);
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        logger.info(`forgotPassword: OTP generated for ${email}`);

        const lang = user.language || 'EN';
        const i18n = emailI18n[lang] || emailI18n['EN'];

        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                }
            });

            await transporter.sendMail({
                from: `"EcoCart 🌱" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: i18n.subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 30px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb;">
                        <h2 style="color: #16a34a; text-align: center;">🌱 EcoCart</h2>
                        <p style="color: #374151; font-size: 16px;">${i18n.greeting(user.name)}</p>
                        <p style="color: #374151;">${i18n.body}</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #16a34a; background: #f0fdf4; padding: 16px 24px; border-radius: 12px; border: 2px dashed #86efac;">
                                ${otp}
                            </span>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; text-align: center;">${i18n.expires}</p>
                        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">${i18n.ignore}</p>
                    </div>
                `
            });

            logger.info(`forgotPassword: OTP email sent in ${lang} to ${email}`);
        } catch (emailError) {
            logger.error(`forgotPassword: failed to send email to ${email}: ${emailError.message}`);
        }

        res.json({ message: 'Reset code sent to your email.' });
    } catch (error) {
        logger.error(`forgotPassword error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || !user.resetPasswordOTP || !user.resetPasswordExpires) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        if (user.resetPasswordExpires < Date.now()) {
            logger.warn(`verifyOTP: expired OTP attempt for ${email}`);
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const isMatch = await bcrypt.compare(otp, user.resetPasswordOTP);
        if (!isMatch) {
            logger.warn(`verifyOTP: invalid OTP attempt for ${email}`);
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        logger.info(`verifyOTP: OTP verified successfully for ${email}`);
        res.json({ message: 'OTP verified successfully' });
    } catch (error) {
        logger.error(`verifyOTP error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        logger.info(`resetPassword: password reset successful for ${email}`);
        res.json({ message: 'Password reset successful! You can now log in.' });
    } catch (error) {
        logger.error(`resetPassword error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    updatePushToken,
    updateProfile,
    getLeaderboard,
    googleLogin,
    forgotPassword,
    verifyOTP,
    resetPassword
};