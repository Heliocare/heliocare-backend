import { notifyPaymentFailed, notifySubscriptionCancelled, sendPaymentReceipt, sendRenewalReceipt } from "../lib/notifications/index.js";

export const PaymentWebhookService = {
    onChargeSuccess: async (email: string, planName: string, amountNaira: string, date: string, isRenewal: boolean) => {
        // Stub: Webhook validation and DB update

        if (isRenewal) {
            sendRenewalReceipt(email, { amount_naira: amountNaira, next_billing_date: date }).catch(() => { });
        } else {
            sendPaymentReceipt(email, { plan_name: planName, amount_naira: amountNaira, date }).catch(() => { });
        }
    },

    onChargeFailed: async (phone: string, isSubscriptionSuspended: boolean) => {
        // Stub: DB logic
        notifyPaymentFailed(phone).catch(() => { });

        if (isSubscriptionSuspended) {
            notifySubscriptionCancelled(phone).catch(() => { });
        }
    }
};
