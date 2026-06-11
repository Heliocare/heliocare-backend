/**
 * @swagger
 * tags:
 *   - name: Treatment Plans
 *     description: Treatment plan creation, versioning, and dietitian referral
 *
 * /api/treatment:
 *   post:
 *     summary: Create a new treatment plan (v1)
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - title
 *             properties:
 *               patientId:
 *                 type: string
 *                 format: uuid
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Treatment plan created
 *       403:
 *         description: Not assigned to this patient
 *
 * /api/treatment/{id}:
 *   get:
 *     summary: Get latest version of a treatment plan
 *     tags: [Treatment Plans]
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
 *         description: Latest treatment plan version
 *   put:
 *     summary: Update treatment plan (creates new version)
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: New version created, old version archived
 *
 * /api/treatment/{id}/history:
 *   get:
 *     summary: Get version history for a treatment plan
 *     tags: [Treatment Plans]
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
 *         description: All versions in the plan lineage
 *
 * /api/treatment/patient/{patientId}:
 *   get:
 *     summary: List all treatment plans for a patient
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of patient's treatment plans
 *
 * /api/treatment/{id}/refer-dietitian:
 *   patch:
 *     summary: Set dietitian referral status on a treatment plan
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dietitianReferralStatus
 *             properties:
 *               dietitianReferralStatus:
 *                 type: string
 *                 enum: [NOT_REFERRED, PENDING, REFERRED, ACCEPTED, DECLINED]
 *               dietitianReferralNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Referral status updated
 *
 * /api/treatment/lab-results/{resultId}/annotate:
 *   patch:
 *     summary: Doctor annotates a lab result
 *     description: Annotation is saved to the lab result and visible to dietitians.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - annotation
 *             properties:
 *               annotation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lab result annotated successfully
 *       403:
 *         description: Only doctors can annotate lab results
 */
