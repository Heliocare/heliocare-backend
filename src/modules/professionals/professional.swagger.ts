/**
 * @swagger
 * tags:
 *   name: Professionals
 *   description: Professional profile management, availability, suspension, and patient reassignment
 */

/**
 * @swagger
 * /api/professionals/profile:
 *   patch:
 *     summary: Complete your professional profile after activation
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, registrationNum]
 *             properties:
 *               fullName: { type: string, example: "Dr. Jane Smith" }
 *               registrationNum: { type: string, example: "MDCN-42-78901" }
 *               specialisation: { type: string, example: "Endocrinology" }
 *               availability: { type: string, example: '[{"day":"MONDAY","startTime":"09:00","endTime":"17:00"}]' }
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *       400:
 *         description: Availability required for your role or invalid format
 *       403:
 *         description: Forbidden - Requires DOCTOR, PHARMACIST, LAB_SCIENTIST, or DIETITIAN
 */

/**
 * @swagger
 * /api/professionals/availability:
 *   patch:
 *     summary: Update your availability schedule and max concurrent patients (Doctor/Dietitian only)
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availability]
 *             properties:
 *               availability:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day: { type: string, enum: [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY] }
 *                     startTime: { type: string, example: "09:00" }
 *                     endTime: { type: string, example: "17:00" }
 *               maxOpenConsults: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Availability updated successfully
 *       403:
 *         description: Forbidden - Requires DOCTOR or DIETITIAN
 */

/**
 * @swagger
 * /api/professionals/{id}/suspend:
 *   patch:
 *     summary: Suspend a professional (Admin only)
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 10, example: "Repeated policy violations and patient complaints" }
 *     responses:
 *       200:
 *         description: Professional suspended — isActive set to false, login blocked
 *       400:
 *         description: Only verified professionals can be suspended
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN
 *       404:
 *         description: Professional not found
 */

/**
 * @swagger
 * /api/professionals/{id}/deactivate:
 *   patch:
 *     summary: Permanently deactivate a professional (Admin only)
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [VOLUNTARY_RESIGNATION, CREDENTIAL_REVOCATION, ETHICS_VIOLATION, INACTIVITY, ADMIN_ACTION]
 *     responses:
 *       200:
 *         description: Professional deactivated permanently — records retained for audit
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN
 *       404:
 *         description: Professional not found
 */

/**
 * @swagger
 * /api/professionals/reassign:
 *   post:
 *     summary: Reassign patients from one professional to another (Admin only)
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromProfessionalId, toProfessionalId, reason]
 *             properties:
 *               fromProfessionalId: { type: string, format: uuid }
 *               toProfessionalId: { type: string, format: uuid }
 *               reason: { type: string, minLength: 10, example: "Reassigning patients due to source professional suspension" }
 *     responses:
 *       200:
 *         description: Patients reassigned — old assignments deleted, new ones created, WhatsApp notifications sent
 *       400:
 *         description: Target professional not verified/available or would exceed max patient capacity
 *       403:
 *         description: Forbidden - Requires ADMIN or SUPER_ADMIN
 *       404:
 *         description: Source or target professional not found
 */

/**
 * @swagger
 * /api/professionals:
 *   get:
 *     summary: List professionals with optional filters
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [VERIFIED, PENDING, SUSPENDED]
 *       - in: query
 *         name: regBody
 *         schema:
 *           type: string
 *           enum: [MDCN, PCN, MLSCN, ODBN]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [DOCTOR, PHARMACIST, LAB_SCIENTIST, DIETITIAN]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of professionals with patient counts
 */

/**
 * @swagger
 * /api/professionals/{id}:
 *   get:
 *     summary: Get a single professional by ID with patient count
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Professional details with user info and patient count
 *       404:
 *         description: Professional not found
 */
