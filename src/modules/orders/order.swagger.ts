/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Prescription fulfillment order lifecycle and pharmacy assignment
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order for a prescription (Doctors/Admins)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, prescriptionId, subscriptionId, drugName, patientStateOfResidence]
 *             properties:
 *               patientId: { type: string, format: uuid }
 *               prescriptionId: { type: string, format: uuid }
 *               subscriptionId: { type: string, format: uuid }
 *               drugName: { type: string, example: "Metformin" }
 *               patientStateOfResidence: { type: string, example: "Lagos" }
 *               deliveryAddrEnc: { type: string }
 *     responses:
 *       201:
 *         description: Order created successfully with PENDING status
 *       400:
 *         description: Prescription is not active or not found
 *       403:
 *         description: Forbidden - Requires DOCTOR, ADMIN, or SUPER_ADMIN
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: List orders with optional filters (role-based row-level filtering)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACKNOWLEDGED, PACKED, DISPATCHED, DELIVERED, FAILED]
 *       - in: query
 *         name: patientId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: pharmacyId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of orders matching filters and role scope
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order details with includes
 *       404:
 *         description: Order not found
 */

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Transition order status (Pharmacy/Pharmacist/Admins)
 *     tags: [Orders]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACKNOWLEDGED, PACKED, DISPATCHED, DELIVERED, FAILED]
 *               trackingNumber: { type: string }
 *               logisticsPartner:
 *                 type: string
 *                 enum: [GIG, KWIK, SENDBOX, OTHER]
 *               estDeliveryDate: { type: string, format: date-time }
 *               pharmacyNotes: { type: string }
 *     responses:
 *       200:
 *         description: Order status transitioned successfully
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Forbidden - Requires PHARMACY, PHARMACIST, ADMIN, or SUPER_ADMIN
 *       404:
 *         description: Order not found
 */
