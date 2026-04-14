(function () {
    'use strict';

    const { MESSAGE_TYPES } = globalThis.HideMatalotMessaging;
    const { DEFAULT_NOTIFICATION_HOUR } = globalThis.HideMatalotReminderTime;
    const debug = () => globalThis.HideMatalotContentDebug;

    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });
    }

    async function saveNotification(notification, assignment) {
        try {
            const id = `${notification.assignmentKey}::${notification.daysBeforeDeadline}::${notification.notificationHour || DEFAULT_NOTIFICATION_HOUR}::${Date.now()}`;
            const payload = {
                ...notification,
                id,
                courseName: assignment.courseName,
                exerciseName: assignment.exerciseName,
                deadline: assignment.deadline,
                time: assignment.time,
                assignmentLink: assignment.assignmentLink || ''
            };

            const result = await sendRuntimeMessage({
                type: MESSAGE_TYPES.SCHEDULE_ASSIGNMENT_NOTIFICATION,
                notification: payload
            });

            if (!result?.success) {
                const suffix = result?.operationId ? ` (${result.operationId})` : '';
                throw new Error((result?.error || 'Failed to schedule notification') + suffix);
            }

            debug().log('Notification scheduled:', id);
            return id;
        } catch (error) {
            console.error('Error saving notification:', error);
            throw error;
        }
    }

    async function getAllNotifications() {
        try {
            const result = await sendRuntimeMessage({ type: MESSAGE_TYPES.GET_SCHEDULED_NOTIFICATIONS });
            if (!result?.success) {
                return [];
            }

            const raw = result.data?.notifications;
            return Array.isArray(raw) ? raw : [];
        } catch (error) {
            console.error('Error fetching all notifications:', error);
            return [];
        }
    }

    async function getNotificationsForAssignment(assignmentKey) {
        const allNotifications = await getAllNotifications();
        return allNotifications.filter((notification) => notification.assignmentKey === assignmentKey);
    }

    async function deleteNotification(notificationId) {
        try {
            const result = await sendRuntimeMessage({
                type: MESSAGE_TYPES.DELETE_ASSIGNMENT_NOTIFICATION,
                notificationId
            });

            if (!result?.success) {
                const suffix = result?.operationId ? ` (${result.operationId})` : '';
                throw new Error((result?.error || 'Failed to delete notification') + suffix);
            }

            debug().log('Notification deleted:', notificationId);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    async function cleanUpNotifications(pairs) {
        try {
            const allNotifications = await getAllNotifications();
            const activeKeys = new Set(pairs.map((p) => p.uniqueKey));

            for (const notification of allNotifications) {
                if (!activeKeys.has(notification.assignmentKey)) {
                    await deleteNotification(notification.id);
                }
            }
            debug().log('Cleaned up stale notifications');
        } catch (error) {
            console.error('Error cleaning up notifications:', error);
        }
    }

    function triggerChromeNotification(exerciseName, courseName, deadline, time) {
        try {
            const deadlineDate = new Date(deadline * 1000);
            const formattedDate = deadlineDate.toLocaleDateString('he-IL');

            const message = `${exerciseName} ב${courseName} עד ${formattedDate} ${time}`;

            console.log('[Content] Sending notification request to background worker:', {
                exerciseName,
                courseName,
                formattedDate,
                time
            });

            chrome.runtime.sendMessage(
                {
                    type: MESSAGE_TYPES.CREATE_NOTIFICATION,
                    title: 'תזכורת להגשת מטלה',
                    message: message,
                    iconUrl: chrome.runtime.getURL('hide128.png')
                },
                (response) => {
                    if (response?.success) {
                        const notificationId = response.data?.notificationId;
                        console.log('[Content] Notification created with ID:', notificationId);
                        debug().log(`Notification created: ${notificationId}`);
                    } else {
                        const detail = response?.operationId
                            ? `${response?.error} (${response.operationId})`
                            : response?.error;
                        console.error('[Content] Notification failed:', detail);
                        debug().log(`Notification failed: ${detail}`);
                    }
                }
            );
        } catch (error) {
            console.error('Error triggering Chrome notification:', error);
            debug().log(`Error triggering notification: ${error.message}`);
        }
    }

    globalThis.HideMatalotRuntimeClient = {
        sendRuntimeMessage,
        saveNotification,
        getAllNotifications,
        getNotificationsForAssignment,
        deleteNotification,
        cleanUpNotifications,
        triggerChromeNotification
    };
})();
