// Service Worker for Hide-Matalot Extension
// Handles desktop notifications and background scheduled reminders.

importScripts(
    'shared/messageContract.js',
    'shared/reminderTime.js',
    'shared/backgroundMessageHandlers.js',
    'shared/fileExports.js'
);

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

const { computeReminderTimestamp, DEFAULT_NOTIFICATION_HOUR } = globalThis.HideMatalotReminderTime;
const createMessageHandlers = globalThis.HideMatalotBackgroundMessageHandlers;
const { saveFile } = globalThis.HideMatalotFileExports;
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

function getAlarmName(notificationId) {
    return `${ALARM_PREFIX}${notificationId}`;
}

/** Legacy ids were `${slotId}::${Date.now()}`; normalize to slot id for deduping. */
function normalizeScheduledNotificationRecordId(id) {
    if (typeof id !== 'string' || !id) {
        return id;
    }
    const parts = id.split('::');
    const last = parts[parts.length - 1];
    if (parts.length >= 4 && /^\d{10,}$/.test(last)) {
        return parts.slice(0, -1).join('::');
    }
    return id;
}

function buildScheduleSlotId(payload) {
    const hour =
        payload.notificationHour != null && payload.notificationHour !== ''
            ? String(payload.notificationHour)
            : DEFAULT_NOTIFICATION_HOUR;
    return `${payload.assignmentKey}::${payload.daysBeforeDeadline}::${hour}`;
}

async function scheduleAlarm(notification) {
    chrome.alarms.create(getAlarmName(notification.id), { when: notification.triggerAt });
}

async function replaceScheduledNotificationSlot(slotId, nextNotification) {
    const notifications = await getScheduledNotifications();
    const removed = notifications.filter(n => normalizeScheduledNotificationRecordId(n.id) === slotId);
    const kept = notifications.filter(n => normalizeScheduledNotificationRecordId(n.id) !== slotId);
    for (const old of removed) {
        await chrome.alarms.clear(getAlarmName(old.id));
    }
    kept.push(nextNotification);
    await setScheduledNotifications(kept);
    await scheduleAlarm(nextNotification);
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
    const bySlot = new Map();
    for (const n of active) {
        const slot = normalizeScheduledNotificationRecordId(n.id);
        const prev = bySlot.get(slot);
        if (!prev || n.triggerAt >= prev.triggerAt) {
            bySlot.set(slot, n);
        }
    }
    const deduped = Array.from(bySlot.values());
    const keptIds = new Set(deduped.map(n => n.id));
    for (const n of active) {
        if (!keptIds.has(n.id)) {
            await chrome.alarms.clear(getAlarmName(n.id));
        }
    }
    await setScheduledNotifications(deduped);
    for (const notification of deduped) {
        await scheduleAlarm(notification);
    }
}

const MESSAGE_HANDLERS = createMessageHandlers({
    MESSAGE_TYPES,
    validateCreateNotification,
    validateScheduleAssignmentNotification,
    validateDeleteAssignmentNotification,
    validateGetScheduledNotifications,
    responseSuccess,
    responseError,
    computeReminderTimestamp,
    buildScheduleSlotId,
    replaceScheduledNotificationSlot,
    getScheduledNotifications,
    setScheduledNotifications,
    scheduleAlarm,
    removeScheduledNotification,
    createDesktopNotification,
    saveFile
});

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
    const handler = type ? MESSAGE_HANDLERS[type] : undefined;

    if (handler) {
        return handler(request, { sendResponse, operationId, sender });
    }

    console.error('[Background Worker]', operationId, 'Unknown message type:', type);
    sendResponse(responseError(type ? `Unknown message type: ${type}` : 'Missing message type', operationId));
    return false;
});

console.log('[Background Worker] Service worker initialized');
