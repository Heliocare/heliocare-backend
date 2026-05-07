import cron from "node-cron";
import { notifyCheckinDay14, notifyCheckinDay25, notifyVideoReminder } from "../lib/notifications/index.js";

export const initCronJobs = () => {
    // Check-in Day 14
    cron.schedule("0 9 * * *", async () => {
        // Stub: fetch patients exactly 14 days post-dispatch
        const phone = "+2348000000000";
        notifyCheckinDay14(phone).catch(() => { });
    });

    // Check-in Day 25
    cron.schedule("0 9 * * *", async () => {
        // Stub: fetch patients exactly 25 days post-dispatch
        const phone = "+2348000000000";
        notifyCheckinDay25(phone).catch(() => { });
    });

    // Video reminders
    cron.schedule("0 * * * *", async () => {
        // Stub: fetch WL video slots 24h or 1h away
        const phone = "+2348000000000";
        notifyVideoReminder(phone, "10:00 AM").catch(() => { });
    });
};
