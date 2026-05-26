/**
 * @swagger
 * tags:
 *   name: Prescriptions
 *   description: Clinical Prescription Issuance, Version Control, and S3 Retrieval
 */

/**
 * @swagger
 * /api/prescriptions:
 *   post:
 *     summary: Issue a new prescription or dose escalation (Doctors only)
 *     tags: [Prescriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, subscriptionId, drugName, doseMg, frequency, quantity, expiresAt]
 *             properties:
 *               patientId: { type: string, format: uuid }
 *               subscriptionId: { type: string, format: uuid }
 *               drugName: { type: string, example: "Semaglutide" }
 *               doseMg: { type: number, example: 0.25 }
 *               frequency: { type: string, example: "Once weekly" }
 *               quantity: { type: integer, example: 4 }
 *               expiresAt: { type: string, format: date-time }
 *               previousPrescriptionId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Prescription issued and signed PDF uploaded successfully
 *       400:
 *         description: Validation error or previous prescription mismatch
 *       403:
 *         description: Forbidden - GLP-1 lab result requirement gate blocked
 *       404:
 *         description: Patient or prescriber profile not found
 */

/**
 * @swagger
 * /api/prescriptions/{id}/pdf:
 *   get:
 *     summary: Get temporary signed URL and redirect to prescription PDF (Authorized roles/patient only)
 *     tags: [Prescriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       302:
 *         description: Redirects successfully to secure S3 URL (15-minute expiration)
 *       403:
 *         description: Not authorized to view this prescription PDF
 *       404:
 *         description: Prescription not found
 */

/**
 * @swagger
 * /api/prescriptions/{id}/cancel:
 *   post:
 *     summary: Cancel an active prescription (Doctors/Admins only)
 *     tags: [Prescriptions]
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
 *               reason: { type: string, minLength: 10, example: "Patient reported severe hypersensitivity side effects." }
 *     responses:
 *       200:
 *         description: Prescription status updated to CANCELLED and reason recorded
 *       400:
 *         description: Prescription is already cancelled
 *       403:
 *         description: Forbidden - Requires DOCTOR, ADMIN, or SUPER_ADMIN
 *       404:
 *         description: Prescription not found
 */
