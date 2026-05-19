/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: Patient Onboarding and Profile Management
 */

/**
 * @swagger
 * /api/onboarding/profile:
 *   post:
 *     summary: Create patient profile (Onboarding Step 1)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, gender, dob, address, stateOfResidence]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *               dob: { type: string, format: date }
 *               address: { type: string }
 *               stateOfResidence: { type: string }
 *               marketingOptIn: { type: boolean }
 *     responses:
 *       201:
 *         description: Profile created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
