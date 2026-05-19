/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative Operations and Staff Management
 */

/**
 * @swagger
 * /api/admin/invite:
 *   post:
 *     summary: Invite a new clinical professional
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, format: email, example: "doctor@test.com" }
 *               role: { type: string, enum: [DOCTOR, PHARMACIST, LAB_SCIENTIST, DIETITIAN], example: "DOCTOR" }
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       400:
 *         description: Email already exists or invalid role for clinical invitation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN role
 */

/**
 * @swagger
 * /api/admin/professionals/pending:
 *   get:
 *     summary: Get pending professional profiles awaiting approval
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending professional profiles retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN role
 */

/**
 * @swagger
 * /api/admin/professionals/{id}/approve:
 *   patch:
 *     summary: Approve and activate a pending professional profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Professional profile ID to approve
 *     responses:
 *       200:
 *         description: Professional approved and activated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN role
 *       404:
 *         description: Professional profile not found
 */
