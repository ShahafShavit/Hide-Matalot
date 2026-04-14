// Service Worker for Hide-Matalot Extension
// Handles desktop notifications and background scheduled reminders.

importScripts('shared/messageContract.js');

const {
    MESSAGE_TYPES,
    newOperationId,
    responseSuccess,
    responseError,
    validateCreateNotification,
    validateScheduleAssignmentNotification,
    validateDeleteAssignmentNotification,
    validateGetScheduledNotifications
} = globalThis.HideMatalotMessaging;

const STORAGE_KEY = 'scheduledNotifications';
const ALARM_PREFIX = 'assignmentNotification:';
const CLICK_URLS_KEY = 'notificationClickUrls';

async function getScheduledNotifications() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function setScheduledNotifications(notifications) {
    await chrome.storage.local.set({ [STORAGE_KEY]: notifications });
}

async function getNotificationClickUrls() {
    const result = await chrome.storage.local.get(CLICK_URLS_KEY);
    return result[CLICK_URLS_KEY] && typeof result[CLICK_URLS_KEY] === 'object'
        ? result[CLICK_URLS_KEY]
        : {};
}

async function setNotificationClickUrls(urlsByNotificationId) {
    await chrome.storage.local.set({ [CLICK_URLS_KEY]: urlsByNotificationId });
}

function createDesktopNotification(title, message, iconUrl, clickUrl, sendResponse, operationId) {
    chrome.notifications.create('', {
        type: 'basic',
        iconUrl,
        title,
        message,
        priority: 2,
        requireInteraction: false
    }, notificationId => {
        if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message;
            console.error('[Background Worker]', operationId, 'Notification error:', errorMessage);
            if (sendResponse) sendResponse(responseError(errorMessage, operationId));
            return;
        }

        console.log('[Background Worker]', operationId, 'Notification created with ID:', notificationId);
        if (clickUrl) {
            getNotificationClickUrls()
                .then(urlMap => {
                    urlMap[notificationId] = clickUrl;
                    return setNotificationClickUrls(urlMap);
                })
                .catch(error => console.error('[Background Worker]', operationId, 'Failed saving click URL:', error));
        }
        if (sendResponse) sendResponse(responseSuccess({ notificationId }));
    });
}

function computeReminderTimestamp(deadline, daysBeforeDeadline, notificationHour) {
    const reminderDate = new Date(deadline * 1000);
    reminderDate.setDate(reminderDate.getDate() - daysBeforeDeadline);
    const [hour, minute] = (notificationHour || '18:00').split(':').map(value => parseInt(value, 10));
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        reminderDate.setHours(hour, minute, 0, 0);
    }
    return reminderDate.getTime();
}

function getAlarmName(notificationId) {
    return `${ALARM_PREFIX}${notificationId}`;
}

async function scheduleAlarm(notification) {
    chrome.alarms.create(getAlarmName(notification.id), { when: notification.triggerAt });
}

async function removeScheduledNotification(notificationId) {
    const notifications = await getScheduledNotifications();
    const updated = notifications.filter(notification => notification.id !== notificationId);
    await setScheduledNotifications(updated);
    await chrome.alarms.clear(getAlarmName(notificationId));
}

async function syncAlarmsFromStorage() {
    const notifications = await getScheduledNotifications();
    const now = Date.now();
    const active = notifications.filter(notification => notification.triggerAt > now);
    await setScheduledNotifications(active);
    for (const notification of active) {
        await scheduleAlarm(notification);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    syncAlarmsFromStorage().catch(error => console.error('[Background Worker] Failed to sync alarms on install:', error));
});

chrome.runtime.onStartup.addListener(() => {
    syncAlarmsFromStorage().catch(error => console.error('[Background Worker] Failed to sync alarms on startup:', error));
});

chrome.alarms.onAlarm.addListener(async alarm => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return;

    const notificationId = alarm.name.replace(ALARM_PREFIX, '');
    const notifications = await getScheduledNotifications();
    const notification = notifications.find(item => item.id === notificationId);
    if (!notification) return;

    const deadlineDate = new Date(notification.deadline * 1000).toLocaleDateString('he-IL');
    const message = `${notification.exerciseName} ב${notification.courseName} עד ${deadlineDate} ${notification.time || ''}`;
    createDesktopNotification(
        'תזכורת להגשת מטלה',
        message,
        chrome.runtime.getURL('hide128.png'),
        notification.assignmentLink || ''
    );

    await removeScheduledNotification(notificationId);
});

chrome.notifications.onClicked.addListener(async notificationId => {
    try {
        const urlMap = await getNotificationClickUrls();
        const targetUrl = urlMap[notificationId];
        if (targetUrl) {
            await chrome.tabs.create({ url: targetUrl });
            delete urlMap[notificationId];
            await setNotificationClickUrls(urlMap);
        }
    } catch (error) {
        console.error('[Background Worker] Failed handling notification click:', error);
    } finally {
        chrome.notifications.clear(notificationId);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const operationId = newOperationId();
    const type = request?.type;

    if (type === MESSAGE_TYPES.CREATE_NOTIFICATION) {
        const validation = validateCreateNotification(request);
        if (!validation.ok) {
            console.error('[Background Worker]', operationId, 'CREATE_NOTIFICATION validation failed:', validation.error);
            sendResponse(responseError(validation.error, operationId));
            return false;
        }
        const { title, message, iconUrl, clickUrl } = request;
        console.log('[Background Worker]', operationId, 'Creating direct notification:', { title, message });
        createDesktopNotification(title, message, iconUrl, clickUrl || '', sendResponse, operationId);
        return true;
    }

    if (type === MESSAGE_TYPES.SCHEDULE_ASSIGNMENT_NOTIFICATION) {
        const validation = validateScheduleAssignmentNotification(request);
        if (!validation.ok) {
            console.error('[Background Worker]', operationId, 'SCHEDULE_ASSIGNMENT_NOTIFICATION validation failed:', validation.error);
            sendResponse(responseError(validation.error, operationId));
            return false;
        }

        (async () => {
            const payload = request.notification;
            const triggerAt = computeReminderTimestamp(payload.deadline, payload.daysBeforeDeadline, payload.notificationHour);
            if (triggerAt <= Date.now()) {
                console.error('[Background Worker]', operationId, 'Reminder time is already in the past');
                sendResponse(responseError('Reminder time is already in the past', operationId));
                return;
            }

            const notifications = await getScheduledNotifications();
            const nextNotification = { ...payload, triggerAt };
            notifications.push(nextNotification);
            await setScheduledNotifications(notifications);
            await scheduleAlarm(nextNotification);

            sendResponse(responseSuccess({ triggerAt }));
        })().catch(error => {
            console.error('[Background Worker]', operationId, 'Failed to schedule notification:', error);
            sendResponse(responseError(String(error), operationId));
        });

        return true;
    }

    if (type === MESSAGE_TYPES.DELETE_ASSIGNMENT_NOTIFICATION) {
        const validation = validateDeleteAssignmentNotification(request);
        if (!validation.ok) {
            console.error('[Background Worker]', operationId, 'DELETE_ASSIGNMENT_NOTIFICATION validation failed:', validation.error);
            sendResponse(responseError(validation.error, operationId));
            return false;
        }

        (async () => {
            await removeScheduledNotification(request.notificationId);
            sendResponse(responseSuccess());
        })().catch(error => {
            console.error('[Background Worker]', operationId, 'Failed to delete notification:', error);
            sendResponse(responseError(String(error), operationId));
        });

        return true;
    }

    if (type === MESSAGE_TYPES.GET_SCHEDULED_NOTIFICATIONS) {
        const validation = validateGetScheduledNotifications(request);
        if (!validation.ok) {
            console.error('[Background Worker]', operationId, 'GET_SCHEDULED_NOTIFICATIONS validation failed:', validation.error);
            sendResponse(responseError(validation.error, operationId));
            return false;
        }

        (async () => {
            const notifications = await getScheduledNotifications();
            sendResponse(responseSuccess({ notifications }));
        })().catch(error => {
            console.error('[Background Worker]', operationId, 'Failed to fetch notifications:', error);
            sendResponse(responseError(String(error), operationId));
        });

        return true;
    }

    console.error('[Background Worker]', operationId, 'Unknown message type:', type);
    sendResponse(responseError(type ? `Unknown message type: ${type}` : 'Missing message type', operationId));
    return false;
});

console.log('[Background Worker] Service worker initialized');
