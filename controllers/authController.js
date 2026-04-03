const User = require('../models/userModel');
const Fridge = require('../models/fridgeModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please enter all fields.' });
    }

    // 1. Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists.' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create User
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
    });

    if (user) {
        // 🆕 4. Automatically create a default fridge for the new user
        try {
            const fridge = await Fridge.create({
                name: `${name}'s Fridge`,
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

            console.log(`Created default fridge for ${name}`);
        } catch (fridgeError) {
            console.error('Error creating default fridge:', fridgeError);
            // Don't fail registration if fridge creation fails
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
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { dietaryPreferences } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (dietaryPreferences !== undefined) {
            user.dietaryPreferences = dietaryPreferences;
        }

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences // 返回最新数据
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getMe = async (req, res) => {
    try {
        // req.user 已经在 middleware 里被赋值了，包含 _id, name, email, ecoPoints 等
        // 但为了保险起见，或者如果 middleware 里的数据不是最新的，可以重查一次
        const user = await User.findById(req.user._id);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            ecoPoints: user.ecoPoints,
            dietaryPreferences: user.dietaryPreferences || []
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const updatePushToken = async (req, res) => {
    const { pushToken } = req.body;

    try {
        //允许 pushToken 为 null 或 空字符串
        // 如果是 null，就会把数据库里的字段清空
        await User.findByIdAndUpdate(req.user._id, {
            pushToken: pushToken || null
        });

        res.json({ message: 'Push token updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    updatePushToken,
    updateProfile
};