import { notifyOrderDispatched, sendOrderDispatchedEmail } from "../lib/notifications/index.js";

export const OrderService = {
    markDispatched: async (_orderId: string, trackingNumber: string, logisticsPartner: string, estDelivery: string) => {
        // Stub: DB update for order status

        const phone = "+2348000000000";
        const email = "patient@example.com";

        notifyOrderDispatched(phone).catch(() => { });
        sendOrderDispatchedEmail(email, {
            tracking_number: trackingNumber,
            logistics_partner: logisticsPartner,
            est_delivery: estDelivery
        }).catch(() => { });
    }
};
