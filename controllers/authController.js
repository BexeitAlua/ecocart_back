const User = require('../models/userModel');
const Fridge = require('../models/fridgeModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jessica Lin
 *               email:
 *                 type: string
 *                 example: jessica@ecocart.app
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please enter all fields.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({ name, email, password: hashedPassword });

        if (user) {
            try {
                const fridge = await Fridge.create({
                    name: `${name}'s Fridge`,
                    emoji: '🧊',
                    ownerId: user._id,
                    members: [{ userId: user._id, role: 'owner' }]
                });
                fridge.generateInviteCode();
                await fridge.save();
                logger.info(`Created default fridge for ${name}`);
            } catch (fridgeError) {
                logger.error(`Error creating default fridge: ${fridgeError.message}`);
            }

            logger.info(`New user registered: ${email}`);
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        logger.error(`registerUser error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: jessica@ecocart.app
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Please enter all fields.' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (user && (await bcrypt.compare(password, user.password))) {
            logger.info(`User logged in: ${email}`);
            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        logger.error(`loginUser error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               dietaryPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
const updateProfile = async (req, res) => {
    try {
        const { dietaryPreferences, city, name } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (dietaryPreferences !== undefined) user.dietaryPreferences = dietaryPreferences;
        if (city !== undefined) user.city = city;
        if (name !== undefined && name.trim() !== '') user.name = name.trim();

        await user.save();
        logger.info(`Profile updated for user: ${req.user._id}`);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences,
            city: user.city
        });
    } catch (error) {
        logger.error(`updateProfile error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Not authorized
 */
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

/**
 * @swagger
 * /api/auth/push-token:
 *   put:
 *     summary: Update push notification token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushToken:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Token updated
 */
const updatePushToken = async (req, res) => {
    try {
        const { pushToken } = req.body;
        await User.findByIdAndUpdate(req.user._id, { pushToken: pushToken || null });
        res.json({ message: 'Push token updated' });
    } catch (error) {
        logger.error(`updatePushToken error: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * @swagger
 * /api/auth/leaderboard:
 *   get:
 *     summary: Get city leaderboard by eco points
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leaderboard data with top users and current user rank
 */
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

module.exports = { registerUser, loginUser, getMe, updatePushToken, updateProfile, getLeaderboard };