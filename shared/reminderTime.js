(function (global) {
    const DEFAULT_NOTIFICATION_HOUR = '18:00';

    /**
     * @param {number | null | undefined} deadlineUnixSec
     * @param {number} daysBeforeDeadline
     * @param {string | null | undefined} notificationHour
     * @returns {Date | null}
     */
    function computeReminderDate(deadlineUnixSec, daysBeforeDeadline, notificationHour) {
        if (deadlineUnixSec == null || typeof deadlineUnixSec !== 'number' || !Number.isFinite(deadlineUnixSec)) {
            return null;
        }

        const reminderDate = new Date(deadlineUnixSec * 1000);
        reminderDate.setDate(reminderDate.getDate() - daysBeforeDeadline);

        const hourStr = notificationHour != null && notificationHour !== '' ? String(notificationHour) : DEFAULT_NOTIFICATION_HOUR;
        const [hour, minute] = hourStr.split(':').map(value => parseInt(value, 10));
        if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
            reminderDate.setHours(hour, minute, 0, 0);
        }

        return reminderDate;
    }

    /**
     * @param {number | null | undefined} deadlineUnixSec
     * @param {number} daysBeforeDeadline
     * @param {string | null | undefined} notificationHour
     * @returns {number}
     */
    function computeReminderTimestamp(deadlineUnixSec, daysBeforeDeadline, notificationHour) {
        const reminderDate = computeReminderDate(deadlineUnixSec, daysBeforeDeadline, notificationHour);
        return reminderDate ? reminderDate.getTime() : NaN;
    }

    /**
     * @param {Date | null | undefined} reminderDate
     * @returns {string}
     */
    function formatReminderDateHeIL(reminderDate) {
        if (!reminderDate) {
            return 'לא ידוע';
        }
        return `${reminderDate.toLocaleDateString('he-IL')} ${reminderDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }

    global.HideMatalotReminderTime = {
        DEFAULT_NOTIFICATION_HOUR,
        computeReminderDate,
        computeReminderTimestamp,
        formatReminderDateHeIL
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
