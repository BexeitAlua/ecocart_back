const CommunityPost = require('../models/communityModel');
const User = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const sendPushNotification = require('../utils/pushSender'); // 引入

// 🆕 Helper: Generate approximate coordinates (add random offset ~500m)
const approximateCoordinates = (lat, lng) => {
    const offset = 0.005; // ~500m
    return {
        latitude: lat + (Math.random() - 0.5) * offset,
        longitude: lng + (Math.random() - 0.5) * offset
    };
};

const getPosts = async (req, res) => {
    try {
        const { city, lat, lng, radius = 10 } = req.query; // radius in km
        let query = { status: { $in: ['available', 'reserved'] } };

        if (city && city !== 'All') {
            query['location.city'] = city;
        }

        let posts = await CommunityPost.find(query)
            .populate('postedBy', 'name email')
            .populate('reservations.userId', 'name')
            .sort({ createdAt: -1 });

        // 🆕 Filter by distance if coordinates provided
        if (lat && lng) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            posts = posts.filter(post => {
                const distance = CommunityPost.calculateDistance(
                    userLat,
                    userLng,
                    post.location.approximateCoords.latitude,
                    post.location.approximateCoords.longitude
                );
                return distance <= parseFloat(radius);
            }).map(post => {
                // Add distance to response
                const distance = CommunityPost.calculateDistance(
                    userLat,
                    userLng,
                    post.location.approximateCoords.latitude,
                    post.location.approximateCoords.longitude
                );
                return {
                    ...post.toObject(),
                    distance: Math.round(distance * 10) / 10 // Round to 1 decimal
                };
            });
        }

        // 🆕 Return only public location for privacy
        const sanitizedPosts = posts.map(post => {
            const postObj = post._doc || post;
            return {
                ...postObj,
                location: post.getPublicLocation ? post.getPublicLocation() : postObj.location,
                // Hide messages count, but show if user has messages
                hasMessages: postObj.messages?.length > 0,
                messageCount: postObj.messages?.length || 0,
                // Show reservation status
                reservationCount: postObj.reservations?.filter(r => r.status === 'pending').length || 0
            };
        });

        res.json(sanitizedPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/community/:id - with privacy-aware location
const getPost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id)
            .populate('postedBy', 'name email')
            .populate('reservations.userId', 'name')
            .populate('messages.from', 'name');

        if (!post) return res.status(404).json({ message: 'Post not found' });

        // Increment view count
        post.viewCount += 1;
        await post.save();

        const response = post.toObject();

        // 🆕 Privacy: Only show exact location if user has permission
        const canSeeExact = post.canSeeExactLocation(req.user._id);

        if (!canSeeExact) {
            response.location = post.getPublicLocation();
            response.contact = post.contact.replace(/\d(?=\d{4})/g, '*'); // Mask phone number
        }

        // Only show own reservations
        response.myReservation = post.reservations.find(
            r => r.userId._id.toString() === req.user._id.toString()
        );

        // Only owner sees all reservations
        if (post.postedBy._id.toString() !== req.user._id.toString()) {
            delete response.reservations;
        }

        res.json({ ...response, canSeeExactLocation: canSeeExact });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/community
const createPost = async (req, res) => {
    try {
        let {
            name, description, contact, imageUrl, tags,
            city, district, publicLocation, exactAddress,
            latitude, longitude
        } = req.body;

        if (!name || !contact || !city || !publicLocation || !latitude || !longitude) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        // Upload image to Cloudinary
        if (imageUrl && imageUrl.startsWith('data:image')) {
            const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
                folder: 'ecocart_community',
                resource_type: 'image',
            });
            imageUrl = uploadResponse.secure_url;
        }

        // 🆕 Generate approximate coordinates for privacy
        const approxCoords = approximateCoordinates(
            parseFloat(latitude),
            parseFloat(longitude)
        );

        const post = await CommunityPost.create({
            postedBy: req.user._id,
            name,
            description,
            location: {
                city,
                district: district || '',
                publicDescription: publicLocation,
                approximateCoords: approxCoords,
                exactAddress: exactAddress || '',
                exactCoords: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude)
                },
                shareExactLocation: false
            },
            contact,
            imageUrl,
            tags: tags || ['Other']
        });

        await post.populate('postedBy', 'name');

        // 发送“新帖通知”给其他用户 👇👇👇
        // 在生产环境中，这里应该只发给"同城"或"附近"的用户
        // 但为了演示，我们发给所有其他用户 (排除自己)
        const otherUsers = await User.find({ _id: { $ne: req.user._id } }, '_id');

        otherUsers.forEach(async (user) => {
            await sendPushNotification(
                user._id,
                `New Food in ${city}! 🥗`, // 标题: New Food in Almaty!
                `${req.user.name} is sharing "${name}". Check it out before it's gone!`, // 内容
                {
                    type: 'community', // 类型
                    postId: post._id   // 关键数据：用于前端跳转
                }
            );
        });
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// POST /api/community/:id/reserve
const createReservation = async (req, res) => {
    try {
        const { message, pickupTime } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.status === 'taken') {
            return res.status(400).json({ message: 'Item already taken' });
        }

        // Check if user already has a reservation
        const existing = post.reservations.find(
            r => r.userId.toString() === req.user._id.toString() &&
                r.status !== 'cancelled'
        );

        if (existing) {
            return res.status(400).json({ message: 'You already have a reservation' });
        }

        post.reservations.push({
            userId: req.user._id,
            message: message || '',
            pickupTime: pickupTime ? new Date(pickupTime) : null,
            status: 'pending'
        });

        // Update post status
        if (post.status === 'available') {
            post.status = 'reserved';
        }

        await post.save();
        await post.populate('reservations.userId', 'name');

        // 1. 获取 Owner 的 Token
        const ownerId = post.postedBy;

        if (ownerId.toString() !== req.user._id.toString()) {
            await sendPushNotification(
                ownerId,
                "New Request! 🎁",
                `${req.user.name} wants your "${post.name}". Open app to reply!`,
                { type: 'community', postId: post._id }
            );
        }

        res.json(post);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 🆕 PUT /api/community/:id/reservation/:reservationId
const updateReservation = async (req, res) => {
    try {
        const { status } = req.body; // 'confirmed', 'cancelled', 'completed'
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        const reservation = post.reservations.id(req.params.reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        // Only owner can confirm
        if (status === 'confirmed' && post.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only owner can confirm' });
        }

        // User can cancel their own reservation
        if (status === 'cancelled' && reservation.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Cannot cancel others reservation' });
        }

        reservation.status = status;

        // If confirmed, mark exact location as shareable for this user
        if (status === 'confirmed') {
            // Award eco points to both users
            await User.findByIdAndUpdate(req.user._id, { $inc: { ecoPoints: 30 } }); // Giver
            await User.findByIdAndUpdate(reservation.userId, { $inc: { ecoPoints: 10 } }); // Receiver
        }

        // If completed, mark post as taken
        if (status === 'completed') {
            post.status = 'taken';
            // Additional points for completion
            await User.findByIdAndUpdate(req.user._id, { $inc: { ecoPoints: 20 } });
        }

        await post.save();
        await post.populate('reservations.userId', 'name');

        res.json(post);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// POST /api/community/:id/message
const sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        post.messages.push({
            from: req.user._id,
            message: message.trim()
        });

        await post.save();
        await post.populate('messages.from', 'name');

        // Return only messages between user and owner
        const filteredMessages = post.messages.filter(m =>
            m.from._id.toString() === req.user._id.toString() ||
            m.from._id.toString() === post.postedBy.toString()
        );

        res.json({ messages: filteredMessages });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 🆕 GET /api/community/:id/messages
const getMessages = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id)
            .populate('messages.from', 'name');

        if (!post) return res.status(404).json({ message: 'Post not found' });

        // Users can only see their own conversation with owner
        const isOwner = post.postedBy.toString() === req.user._id.toString();

        const filteredMessages = isOwner
            ? post.messages // Owner sees all
            : post.messages.filter(m => // Users see only their conversation
                m.from._id.toString() === req.user._id.toString() ||
                m.from._id.toString() === post.postedBy.toString()
            );

        res.json({ messages: filteredMessages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updatePostStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (post.status !== 'taken' && status === 'taken') {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { ecoPoints: 50 }
            });
        }

        post.status = status;
        await post.save();

        res.json(post);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deletePost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await post.deleteOne();
        res.json({ message: 'Post deleted', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const getCharities = async (req, res) => {
    try {

        const charities = await Charity.find({}).sort({ verified: -1, createdAt: -1 });

        if (charities.length === 0) {
            console.log("No charities found in DB, please run seed script.");
        }

        res.json(charities);
    } catch (error) {
        console.error("Error fetching charities:", error);
        res.status(500).json({ message: "Failed to load charities" });
    }
};

module.exports = {
    getPosts,
    getPost,
    createPost,
    updatePostStatus,
    deletePost,
    createReservation,
    updateReservation,
    sendMessage,
    getMessages
};