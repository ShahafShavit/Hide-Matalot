(function (global) {
    function createMessageHandlers(deps) {
        const {
            MESSAGE_TYPES,
            validateCreateNotification,
            validateScheduleAssignmentNotification,
            validateDeleteAssignmentNotification,
            validateGetScheduledNotifications,
            responseSuccess,
            responseError,
            computeReminderTimestamp,
            getScheduledNotifications,
            setScheduledNotifications,
            scheduleAlarm,
            removeScheduledNotification,
            createDesktopNotification
        } = deps;

        function handleCreateNotification(request, { sendResponse, operationId }) {
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

        function handleScheduleAssignmentNotification(request, { sendResponse, operationId }) {
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

        function handleDeleteAssignmentNotification(request, { sendResponse, operationId }) {
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

        function handleGetScheduledNotifications(request, { sendResponse, operationId }) {
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

        return {
            [MESSAGE_TYPES.CREATE_NOTIFICATION]: handleCreateNotification,
            [MESSAGE_TYPES.SCHEDULE_ASSIGNMENT_NOTIFICATION]: handleScheduleAssignmentNotification,
            [MESSAGE_TYPES.DELETE_ASSIGNMENT_NOTIFICATION]: handleDeleteAssignmentNotification,
            [MESSAGE_TYPES.GET_SCHEDULED_NOTIFICATIONS]: handleGetScheduledNotifications
        };
    }

    global.HideMatalotBackgroundMessageHandlers = createMessageHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
