(function (global) {
    const MESSAGE_TYPES = Object.freeze({
        CREATE_NOTIFICATION: 'CREATE_NOTIFICATION',
        SCHEDULE_ASSIGNMENT_NOTIFICATION: 'SCHEDULE_ASSIGNMENT_NOTIFICATION',
        DELETE_ASSIGNMENT_NOTIFICATION: 'DELETE_ASSIGNMENT_NOTIFICATION',
        GET_SCHEDULED_NOTIFICATIONS: 'GET_SCHEDULED_NOTIFICATIONS'
    });

    const DAYS_BEFORE_MIN = 1;
    const DAYS_BEFORE_MAX = 365;

    const NOTIFICATION_HOUR_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

    function newOperationId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function responseSuccess(data) {
        if (data === undefined) {
            return { success: true };
        }
        return { success: true, data };
    }

    function responseError(message, operationId) {
        return {
            success: false,
            error: message,
            operationId
        };
    }

    function validateNotificationHour(value) {
        if (value == null || value === '') {
            return { valid: false, error: 'notificationHour is required' };
        }
        const s = String(value);
        if (!NOTIFICATION_HOUR_RE.test(s)) {
            return { valid: false, error: 'notificationHour must be HH:MM (00:00–23:59)' };
        }
        return { valid: true, value: s };
    }

    function validateCreateNotification(request) {
        if (!request || typeof request !== 'object') {
            return { ok: false, error: 'Invalid message' };
        }
        const errors = [];
        if (typeof request.title !== 'string' || !request.title.trim()) {
            errors.push('title is required');
        }
        if (typeof request.message !== 'string' || !request.message.trim()) {
            errors.push('message is required');
        }
        if (typeof request.iconUrl !== 'string' || !request.iconUrl.trim()) {
            errors.push('iconUrl is required');
        }
        if (request.clickUrl != null && typeof request.clickUrl !== 'string') {
            errors.push('clickUrl must be a string');
        }
        if (errors.length) {
            return { ok: false, error: errors.join('; ') };
        }
        return { ok: true };
    }

    function validateScheduleAssignmentNotification(request) {
        if (!request || typeof request !== 'object') {
            return { ok: false, error: 'Invalid message' };
        }
        const payload = request.notification;
        if (!payload || typeof payload !== 'object') {
            return { ok: false, error: 'notification payload is required' };
        }
        const errors = [];

        if (typeof payload.id !== 'string' || !payload.id.trim()) {
            errors.push('notification.id is required');
        }
        if (typeof payload.deadline !== 'number' || !Number.isFinite(payload.deadline)) {
            errors.push('notification.deadline must be a finite number (Unix seconds)');
        }
        if (!Number.isInteger(payload.daysBeforeDeadline)) {
            errors.push('notification.daysBeforeDeadline must be an integer');
        } else if (payload.daysBeforeDeadline < DAYS_BEFORE_MIN || payload.daysBeforeDeadline > DAYS_BEFORE_MAX) {
            errors.push(`notification.daysBeforeDeadline must be between ${DAYS_BEFORE_MIN} and ${DAYS_BEFORE_MAX}`);
        }
        const hourCheck = validateNotificationHour(payload.notificationHour != null ? payload.notificationHour : '18:00');
        if (!hourCheck.valid) {
            errors.push(hourCheck.error);
        }
        if (typeof payload.courseName !== 'string' || !payload.courseName.trim()) {
            errors.push('notification.courseName is required');
        }
        if (typeof payload.exerciseName !== 'string' || !payload.exerciseName.trim()) {
            errors.push('notification.exerciseName is required');
        }
        if (payload.assignmentLink != null && typeof payload.assignmentLink !== 'string') {
            errors.push('notification.assignmentLink must be a string');
        }
        if (payload.time != null && typeof payload.time !== 'string') {
            errors.push('notification.time must be a string');
        }

        if (errors.length) {
            return { ok: false, error: errors.join('; ') };
        }
        return { ok: true };
    }

    function validateDeleteAssignmentNotification(request) {
        if (!request || typeof request !== 'object') {
            return { ok: false, error: 'Invalid message' };
        }
        if (typeof request.notificationId !== 'string' || !request.notificationId.trim()) {
            return { ok: false, error: 'notificationId is required' };
        }
        return { ok: true };
    }

    function validateGetScheduledNotifications(request) {
        if (request != null && typeof request !== 'object') {
            return { ok: false, error: 'Invalid message' };
        }
        return { ok: true };
    }

    global.HideMatalotMessaging = {
        MESSAGE_TYPES,
        DAYS_BEFORE_MIN,
        DAYS_BEFORE_MAX,
        newOperationId,
        responseSuccess,
        responseError,
        validateCreateNotification,
        validateScheduleAssignmentNotification,
        validateDeleteAssignmentNotification,
        validateGetScheduledNotifications
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
