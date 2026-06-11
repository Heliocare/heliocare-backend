/**
 * @swagger
 * tags:
 *   name: Intake
 *   description: Medical Intake Sessions and Exclusion Logic
 */

/**
 * @swagger
 * /api/intake/start:
 *   post:
 *     summary: Start a new medical intake session
 *     tags: [Intake]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vertical]
 *             properties:
 *               vertical: { type: string, enum: [ED, WEIGHT_LOSS] }
 *     responses:
 *       201:
 *         description: Intake started successfully
 *       404:
 *         description: Patient profile required
 *       409:
 *         description: Active intake already exists
 */

/**
 * @swagger
 * /api/intake/{intakeId}/step/{stepNumber}:
 *   post:
 *     summary: Save intake step responses
 *     tags: [Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: intakeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: stepNumber
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The responses for this step
 *     responses:
 *       200:
 *         description: Step saved successfully
 *       403:
 *         description: Not authorized or intake is locked
 *       404:
 *         description: Intake not found
 */

/**
 * @swagger
 * /api/intake/{intakeId}/submit:
 *   post:
 *     summary: Submit intake for clinical review
 *     tags: [Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: intakeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Intake submitted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Intake not found
 */

/**
 * @swagger
 * /api/intake/{intakeId}/unlock:
 *   post:
 *     summary: Unlock a submitted intake (Doctor/Admin only)
 *     tags: [Intake]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: intakeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Intake unlocked successfully
 *       400:
 *         description: Intake is already unlocked
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Intake not found
 */
