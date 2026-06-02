/**
 * @swagger
 * tags:
 *   - name: Patients
 *     description: Patient profile management and NDPR compliance endpoints
 *
 * /api/patients/me:
 *   get:
 *     summary: Get own patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile with decrypted PII
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update own patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER, NOT_SPECIFIED]
 *               dob:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *               address:
 *                 type: string
 *               stateOfResidence:
 *                 type: string
 *               marketingOptIn:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *   delete:
 *     summary: NDPR data deletion request
 *     description: Submits a data erasure request with a 30-day grace period.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request submitted
 *
 * /api/patients/me/export:
 *   get:
 *     summary: NDPR comprehensive data export
 *     description: Exports all patient data across all record types with encrypted fields decrypted.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comprehensive patient data export
 *
 * /api/patients/me/correct:
 *   patch:
 *     summary: NDPR data correction
 *     description: Submit a data rectification request with before/after audit trail.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - corrections
 *               - reason
 *             properties:
 *               corrections:
 *                 type: object
 *                 description: "Field-level corrections keyed by field name"
 *               reason:
 *                 type: string
 *                 minLength: 10
 *     responses:
 *       200:
 *         description: Data correction submitted successfully
 *       400:
 *         description: Invalid correction fields
 *
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient profile by ID (professional/admin)
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Patient profile
 *       403:
 *         description: Not assigned to this patient
 *       404:
 *         description: Patient not found
 */
