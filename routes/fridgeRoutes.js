const express = require('express');
const {
    getUserFridges,
    getFridge,
    createFridge,
    updateFridge,
    deleteFridge,
    generateInviteCode,
    joinFridge,
    leaveFridge,
    removeMember
} = require('../controllers/fridgeController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/fridges:
 *   get:
 *     summary: Get all fridges of current user
 *     tags: [Fridges]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user fridges
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Fridge'
 *       401:
 *         description: Not authorized
 */
router.get('/', getUserFridges);

/**
 * @swagger
 * /api/fridges:
 *   post:
 *     summary: Create a new fridge
 *     tags: [Fridges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Kitchen Fridge
 *               emoji:
 *                 type: string
 *                 example: 🧊
 *     responses:
 *       201:
 *         description: Fridge created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fridge'
 *       400:
 *         description: Bad request
 */
router.post('/', createFridge);

/**
 * @swagger
 * /api/fridges/{id}:
 *   get:
 *     summary: Get a specific fridge by ID
 *     tags: [Fridges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Fridge ID
 *     responses:
 *       200:
 *         description: Fridge data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fridge'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Fridge not found
 */
router.get('/:id', getFridge);

/**
 * @swagger
 * /api/fridges/{id}:
 *   put:
 *     summary: Update fridge name or emoji
 *     tags: [Fridges]
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: Family Fridge
 *               emoji:
 *                 type: string
 *                 example: 🏠
 *     responses:
 *       200:
 *         description: Fridge updated
 *       403:
 *         description: Only owner can update
 *       404:
 *         description: Fridge not found
 */
router.put('/:id', updateFridge);

/**
 * @swagger
 * /api/fridges/{id}:
 *   delete:
 *     summary: Delete a fridge (owner only)
 *     tags: [Fridges]
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
 *         description: Fridge deleted
 *       403:
 *         description: Only owner can delete
 *       404:
 *         description: Fridge not found
 */
router.delete('/:id', deleteFridge);

/**
 * @swagger
 * /api/fridges/{id}/invite:
 *   post:
 *     summary: Generate new invite code for fridge
 *     tags: [Fridges]
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
 *         description: New invite code generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inviteCode:
 *                   type: string
 *                   example: ECO-ABC123
 *       403:
 *         description: Only owner can generate invite code
 */
router.post('/:id/invite', generateInviteCode);

/**
 * @swagger
 * /api/fridges/join:
 *   post:
 *     summary: Join a fridge using invite code
 *     tags: [Fridges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteCode]
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 example: ECO-ABC123
 *     responses:
 *       200:
 *         description: Successfully joined fridge
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fridge'
 *       400:
 *         description: Invalid invite code or already a member
 *       404:
 *         description: Fridge not found
 */
router.post('/join', joinFridge);

/**
 * @swagger
 * /api/fridges/{id}/leave:
 *   post:
 *     summary: Leave a fridge
 *     tags: [Fridges]
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
 *         description: Successfully left the fridge
 *       400:
 *         description: Owner cannot leave (must delete fridge instead)
 *       404:
 *         description: Fridge not found
 */
router.post('/:id/leave', leaveFridge);

/**
 * @swagger
 * /api/fridges/{id}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from fridge (owner only)
 *     tags: [Fridges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Fridge ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member user ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       403:
 *         description: Only owner can remove members
 *       404:
 *         description: Fridge or member not found
 */
router.delete('/:id/members/:memberId', removeMember);

module.exports = router;