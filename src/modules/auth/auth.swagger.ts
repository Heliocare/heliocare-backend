/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - ndprConsent
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: favour@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: Password123!
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         ndprConsent:
 *           type: boolean
 *           example: true
 *           description: Must be true to register
 *         marketingOptIn:
 *           type: boolean
 *           example: false
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [PATIENT, DOCTOR, PHARMACY, ADMIN, SUPER_ADMIN]
 *         isActive:
 *           type: boolean
 *         isEmailVerified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: favour@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: Password123!
 */


// --- Endpoint Documentation ---

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and Account Management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful. Returns access and refresh tokens.
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   post:
 *     summary: Verify user email address
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token sent to user email
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset link sent if account exists
 */

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Uses the refreshToken cookie to generate a new accessToken.
 *     responses:
 *       200:
 *         description: New access token returned
 *       401:
 *         description: Invalid or expired refresh token
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     description: Clears the refreshToken cookie.
 *     responses:
 *       200:
 *         description: Logged out successfully
 */

/**
 * @swagger
 * /api/auth/me/export:
 *   get:
 *     summary: Export user patient data
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full JSON of the user's patient data
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/me/deletion:
 *   delete:
 *     summary: Request account deletion
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account flagged for deletion
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/unlock/request:
 *   post:
 *     summary: Request an account unlock email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Unlock email sent if account exists
 */

/**
 * @swagger
 * /api/auth/unlock/verify/{token}:
 *   post:
 *     summary: Unlock account using token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account unlocked successfully
 *       400:
 *         description: Invalid or expired token
 */