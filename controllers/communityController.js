const CommunityPost = require('../models/communityModel');
const User = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const sendPushNotification = require('../utils/pushSender');
const Charity = require('../models/charityModel');
const notificationI18n = require('../utils/notificationI18n');
const logger = require('../config/logger');

const approximateCoordinates = (lat, lng) => {
    const offset = 0.005;
    return {
        latitude: lat + (Math.random() - 0.5) * offset,
        longitude: lng + (Math.random() - 0.5) * offset
    };
};

const getPosts = async (req, res) => {
    try {
        const { city, lat, lng, radius = 10 } = req.query;
        let query = { status: { $in: ['available', 'reserved'] } };

        if (city && city !== 'All') {
            query['location.city'] = city;
        }

        let posts = await CommunityPost.find(query)
            .populate('postedBy', 'name email')
            .populate('reservations.userId', 'name')
            .sort({ createdAt: -1 });

        if (lat && lng) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            posts = posts.filter(post => {
                const distance = CommunityPost.calculateDistance(
                    userLat, userLng,
                    post.location.approximateCoords.latitude,
                    post.location.approximateCoords.longitude
                );
                return distance <= parseFloat(radius);
            }).map(post => {
                const distance = CommunityPost.calculateDistance(
                    userLat, userLng,
                    post.location.approximateCoords.latitude,
                    post.location.approximateCoords.longitude
                );
                return {
                    ...post.toObject(),
                    distance: Math.round(distance * 10) / 10
                };
            });

            logger.debug(`getPosts: filtered to ${posts.length} posts within ${radius}km of [${userLat}, ${userLng}]`);
        }

        const sanitizedPosts = posts.map(post => {
            const postObj = post._doc || post;
            return {
                ...postObj,
                location: post.getPublicLocation ? post.getPublicLocation() : postObj.location,
                hasMessages: postObj.messages?.length > 0,
                messageCount: postObj.messages?.length || 0,
                reservationCount: postObj.reservations?.filter(r => r.status === 'pending').length || 0
            };
        });

        logger.info(`getPosts: returned ${sanitizedPosts.length} posts | city: ${city || 'all'}`);
        res.json(sanitizedPosts);
    } catch (error) {
        logger.error(`getPosts error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

const getPost = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id)
            .populate('postedBy', 'name email')
            .populate('reservations.userId', 'name')
            .populate('messages.from', 'name');

        if (!post) return res.status(404).json({ message: 'Post not found' });

        post.viewCount += 1;
        await post.save();

        const response = post.toObject();
        const canSeeExact = post.canSeeExactLocation(req.user._id);

        if (!canSeeExact) {
            response.location = post.getPublicLocation();
            response.contact = post.contact.replace(/\d(?=\d{4})/g, '*');
        }

        response.myReservation = post.reservations.find(
            r => r.userId._id.toString() === req.user._id.toString()
        );

        if (post.postedBy._id.toString() !== req.user._id.toString()) {
            delete response.reservations;
        }

        logger.info(`getPost: post ${req.params.id} viewed by user ${req.user._id} | exactLocation: ${canSeeExact}`);
        res.json({ ...response, canSeeExactLocation: canSeeExact });
    } catch (error) {
        logger.error(`getPost error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

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

        if (imageUrl && imageUrl.startsWith('data:image')) {
            const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
                folder: 'ecocart_community',
                resource_type: 'image',
            });
            imageUrl = uploadResponse.secure_url;
            logger.debug(`createPost: image uploaded to Cloudinary for post "${name}"`);
        }

        const approxCoords = approximateCoordinates(parseFloat(latitude), parseFloat(longitude));

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
        logger.info(`createPost: post "${name}" created by user ${req.user._id} in ${city}`);

        const targetUsers = await User.find({
            _id: { $ne: req.user._id },
            city: city
        }, '_id language');

        logger.info(`createPost: sending notifications to ${targetUsers.length} users in ${city}`);

        targetUsers.forEach(async (user) => {
            const i18n = notificationI18n[user.language] || notificationI18n['EN'];
            await sendPushNotification(
                user._id,
                i18n.newFoodTitle(city),
                i18n.newFoodBody(req.user.name, name),
                { type: 'community', postId: post._id }
            );
        });

        res.status(201).json(post);
    } catch (error) {
        logger.error(`createPost error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

const createReservation = async (req, res) => {
    try {
        const { message, pickupTime } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.status === 'taken') {
            return res.status(400).json({ message: 'Item already taken' });
        }

        const existing = post.reservations.find(
            r => r.userId.toString() === req.user._id.toString() && r.status !== 'cancelled'
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

        if (post.status === 'available') {
            post.status = 'reserved';
        }

        await post.save();
        await post.populate('reservations.userId', 'name');
        logger.info(`createReservation: user ${req.user._id} reserved post ${post._id}`);

        const ownerId = post.postedBy;
        if (ownerId.toString() !== req.user._id.toString()) {
            const owner = await User.findById(ownerId, 'language');
            const i18n = notificationI18n[owner?.language] || notificationI18n['EN'];
            await sendPushNotification(
                ownerId,
                i18n.newRequestTitle,
                i18n.newRequestBody(req.user.name, post.name),
                { type: 'community', postId: post._id }
            );
            logger.debug(`createReservation: notified owner ${ownerId}`);
        }

        res.json(post);
    } catch (error) {
        logger.error(`createReservation error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

const updateReservation = async (req, res) => {
    try {
        const { status } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        const reservation = post.reservations.id(req.params.reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        if (status === 'confirmed' && post.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only owner can confirm' });
        }

        if (status === 'cancelled' && reservation.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Cannot cancel others reservation' });
        }

        reservation.status = status;

        if (status === 'confirmed') {
            await User.findByIdAndUpdate(req.user._id, { $inc: { ecoPoints: 30 } });
            await User.findByIdAndUpdate(reservation.userId, { $inc: { ecoPoints: 10 } });
            logger.info(`updateReservation: reservation ${reservation._id} confirmed | +30pts giver, +10pts receiver`);
        }

        if (status === 'completed') {
            post.status = 'taken';
            await User.findByIdAndUpdate(req.user._id, { $inc: { ecoPoints: 20 } });
            logger.info(`updateReservation: post ${post._id} marked as taken | +20pts to user ${req.user._id}`);
        }

        await post.save();
        await post.populate('reservations.userId', 'name');

        logger.info(`updateReservation: reservation ${reservation._id} → ${status}`);
        res.json(post);
    } catch (error) {
        logger.error(`updateReservation error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const post = await CommunityPost.findById(req.params.id);

        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        post.messages.push({ from: req.user._id, message: message.trim() });
        await post.save();
        await post.populate('messages.from', 'name');

        const filteredMessages = post.messages.filter(m =>
            m.from._id.toString() === req.user._id.toString() ||
            m.from._id.toString() === post.postedBy.toString()
        );

        logger.info(`sendMessage: user ${req.user._id} sent message on post ${post._id}`);
        res.json({ messages: filteredMessages });
    } catch (error) {
        logger.error(`sendMessage error: ${error.message}`);
        res.status(400).json({ message: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id)
            .populate('messages.from', 'name');

        if (!post) return res.status(404).json({ message: 'Post not found' });

        const isOwner = post.postedBy.toString() === req.user._id.toString();

        const filteredMessages = isOwner
            ? post.messages
            : post.messages.filter(m =>
                m.from._id.toString() === req.user._id.toString() ||
                m.from._id.toString() === post.postedBy.toString()
            );

        logger.debug(`getMessages: ${filteredMessages.length} messages returned for post ${post._id} | isOwner: ${isOwner}`);
        res.json({ messages: filteredMessages });
    } catch (error) {
        logger.error(`getMessages error: ${error.message}`);
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
            const user = await User.findById(req.user._id);
            if (user) {
                const pointsEarned = 50;
                user.ecoPoints += pointsEarned;

                if (!user.efficiencyStats) {
                    user.efficiencyStats = { itemsConsumed: 0, itemsWasted: 0 };
                }
                user.efficiencyStats.itemsConsumed += 1;

                user.pointsHistory.push({
                    points: user.ecoPoints,
                    reason: `Shared ${post.name}`,
                    date: new Date()
                });

                await user.save();
                logger.info(`updatePostStatus: post ${post._id} marked as taken | +${pointsEarned} ecoPoints to user ${req.user._id}`);
            }
        }

        post.status = status;
        await post.save();

        logger.info(`updatePostStatus: post ${post._id} status → ${status}`);
        res.json(post);
    } catch (error) {
        logger.error(`updatePostStatus error: ${error.message}`);
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
        logger.info(`deletePost: post ${req.params.id} deleted by user ${req.user._id}`);
        res.json({ message: 'Post deleted', id: req.params.id });
    } catch (error) {
        logger.error(`deletePost error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

const getCharities = async (req, res) => {
    try {
        const charities = await Charity.find({}).sort({ verified: -1, createdAt: -1 });

        if (charities.length === 0) {
            logger.warn('getCharities: no charities found in DB — run seed script');
        } else {
            logger.debug(`getCharities: returned ${charities.length} charities`);
        }

        res.json(charities);
    } catch (error) {
        logger.error(`getCharities error: ${error.message}`);
        res.status(500).json({ message: 'Failed to load charities' });
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
    getMessages,
    getCharities
};