import { notifyConsultationApproved, sendPrescriptionReady } from "../lib/notifications/index.js";

export const PrescriptionService = {
    issuePrescription: async (_patientId: string, doctorName: string, signedPdfUrl: string) => {
        // Stub: In a real app, generate the prescription and save to DB

        // Mock patient contact details
        const phone = "+2348000000000";
        const email = "patient@example.com";

        // Trigger notifications fire-and-forget
        notifyConsultationApproved(phone).catch(() => { });
        sendPrescriptionReady(email, doctorName, signedPdfUrl).catch(() => { });
    }
};
