const express = require('express');
const {
    getPosts,
    createPost,
    deletePost,
    getPost,
    updatePostStatus,
    createReservation,
    updateReservation,
    sendMessage,
    getMessages,
    getCharities
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/community:
 *   get:
 *     summary: Get all community food sharing posts
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *         example: Almaty
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by food category
 *         example: Fruit
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, reserved, taken]
 *         description: Filter by post status
 *     responses:
 *       200:
 *         description: List of community posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommunityPost'
 */
router.get('/', getPosts);

/**
 * @swagger
 * /api/community:
 *   post:
 *     summary: Create a food sharing post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, location]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Fresh apples from my garden
 *               description:
 *                 type: string
 *                 example: I have about 2kg of fresh apples, free to take!
 *               category:
 *                 type: string
 *                 example: Fruit
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 43.238
 *                   lng:
 *                     type: number
 *                     example: 76.889
 *               imageUrl:
 *                 type: string
 *                 description: Base64 image or URL
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: '2026-04-05'
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: Missing required fields
 */
router.post('/', createPost);

/**
 * @swagger
 * /api/community/charities:
 *   get:
 *     summary: Get all charity organizations
 *     description: Returns a list of verified charity organizations that accept food donations, sorted by verification status and creation date.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of charity organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                     example: Almaty Food Bank
 *                   description:
 *                     type: string
 *                     example: We distribute food to families in need
 *                   city:
 *                     type: string
 *                     enum: [All, Almaty, Astana, Shymkent, Karaganda, Aktau, Atyrau, Other]
 *                     example: Almaty
 *                   address:
 *                     type: string
 *                     example: 123 Abai Avenue
 *                   contact:
 *                     type: string
 *                     example: '+7 777 123 4567'
 *                   website:
 *                     type: string
 *                     example: https://almatyfoodbank.kz
 *                   imageUrl:
 *                     type: string
 *                   needs:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: [Canned Food, Rice, Pasta]
 *                   verified:
 *                     type: boolean
 *                     example: true
 *       500:
 *         description: Failed to load charities
 */

router.get('/charities', getCharities);

/**
 * @swagger
 * /api/community/{id}:
 *   get:
 *     summary: Get a single community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Community post data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       404:
 *         description: Post not found
 */
router.get('/:id', getPost);

/**
 * @swagger
 * /api/community/{id}/status:
 *   put:
 *     summary: Update post status (owner only)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [available, reserved, taken]
 *                 example: taken
 *     responses:
 *       200:
 *         description: Status updated
 *       403:
 *         description: Only post owner can update status
 *       404:
 *         description: Post not found
 */
router.put('/:id/status', updatePostStatus);

/**
 * @swagger
 * /api/community/{id}:
 *   delete:
 *     summary: Delete a community post (owner only)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted
 *       403:
 *         description: Only post owner can delete
 *       404:
 *         description: Post not found
 */
router.delete('/:id', deletePost);

/**
 * @swagger
 * /api/community/{id}/reserve:
 *   post:
 *     summary: Create a reservation for a post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: I would like to take these apples!
 *     responses:
 *       201:
 *         description: Reservation created
 *       400:
 *         description: Post not available or already reserved by user
 *       404:
 *         description: Post not found
 */
router.post('/:id/reserve', createReservation);

/**
 * @swagger
 * /api/community/{id}/reservation/{reservationId}:
 *   put:
 *     summary: Update reservation status (approve/reject)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community post ID
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: approved
 *     responses:
 *       200:
 *         description: Reservation updated
 *       403:
 *         description: Only post owner can update reservations
 *       404:
 *         description: Post or reservation not found
 */
router.put('/:id/reservation/:reservationId', updateReservation);

/**
 * @swagger
 * /api/community/{id}/message:
 *   post:
 *     summary: Send a message on a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: Is this still available?
 *     responses:
 *       201:
 *         description: Message sent
 *       404:
 *         description: Post not found
 */
router.post('/:id/message', sendMessage);

/**
 * @swagger
 * /api/community/{id}/messages:
 *   get:
 *     summary: Get all messages for a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   text:
 *                     type: string
 *                   senderId:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *       404:
 *         description: Post not found
 */
router.get('/:id/messages', getMessages);

module.exports = router;