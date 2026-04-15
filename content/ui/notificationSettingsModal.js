(function () {
    'use strict';

    const {
        DEFAULT_NOTIFICATION_HOUR,
        computeReminderDate,
        formatReminderDateHeIL
    } = globalThis.HideMatalotReminderTime;

    const client = () => globalThis.HideMatalotRuntimeClient;
    const debug = () => globalThis.HideMatalotContentDebug;

    async function displayNotificationSettings(pair, pairs) {
        const { courseName, exerciseName, uniqueKey, deadline, time } = pair;

        const existing = document.getElementById('notification-settings-modal');
        if (existing) document.body.removeChild(existing);

        const modal = document.createElement('div');
        modal.id = 'notification-settings-modal';
        modal.className = 'hm-modal';

        const overlay = document.createElement('div');
        overlay.className = 'hm-modal-overlay';
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        document.body.appendChild(overlay);

        const header = document.createElement('h5');
        header.className = 'hm-modal-header';
        header.innerText = `${exerciseName} - ${courseName}`;
        modal.appendChild(header);

        const deadlineInfo = document.createElement('div');
        deadlineInfo.className = 'hm-muted';
        const deadlineDate = deadline ? new Date(deadline * 1000).toLocaleDateString() : 'Unknown';
        deadlineInfo.innerText = `\u05ea\u05d0\u05e8\u05d9\u05da \u05d4\u05d2\u05e9\u05d4: ${deadlineDate} ${time}`;
        modal.appendChild(deadlineInfo);

        const listHeader = document.createElement('div');
        listHeader.className = 'hm-section-title';
        listHeader.innerText = 'התראות קיימות:';
        modal.appendChild(listHeader);

        const notificationsList = document.createElement('div');
        notificationsList.id = 'notifications-list';
        notificationsList.className = 'hm-notifications-list';
        modal.appendChild(notificationsList);

        const existingNotifications = await client().getNotificationsForAssignment(pair);
        const displayNotifications = () => {
            notificationsList.innerHTML = '';
            if (existingNotifications.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'hm-muted hm-muted--flush';
                empty.innerText = 'אין התראות';
                notificationsList.appendChild(empty);
            } else {
                existingNotifications.forEach((notif) => {
                    const notifRow = document.createElement('div');
                    notifRow.className = 'hm-notif-row';

                    const notifText = document.createElement('span');
                    const reminderDate = computeReminderDate(deadline, notif.daysBeforeDeadline, notif.notificationHour);
                    notifText.innerText = `${notif.daysBeforeDeadline} יום לפני · ${formatReminderDateHeIL(reminderDate)}`;

                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'hm-notif-delete';
                    deleteBtn.innerText = '\u274C';
                    deleteBtn.addEventListener('click', async () => {
                        await client().deleteNotification(notif.id);
                        const index = existingNotifications.indexOf(notif);
                        if (index > -1) {
                            existingNotifications.splice(index, 1);
                        }
                        displayNotifications();
                    });

                    notifRow.appendChild(notifText);
                    notifRow.appendChild(deleteBtn);
                    notificationsList.appendChild(notifRow);
                });
            }
        };
        displayNotifications();

        const addHeader = document.createElement('div');
        addHeader.className = 'hm-section-title';
        addHeader.innerText = 'הוסף התראה חדשה:';
        modal.appendChild(addHeader);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'hm-input-row';

        const daysInput = document.createElement('input');
        daysInput.type = 'number';
        daysInput.min = '1';
        daysInput.max = '365';
        daysInput.placeholder = 'ימים לפני הדדליין';
        daysInput.className = 'hm-input-days';

        const hourInput = document.createElement('input');
        hourInput.type = 'time';
        hourInput.value = DEFAULT_NOTIFICATION_HOUR;
        hourInput.step = '60';
        hourInput.className = 'hm-input-hour';

        const previewText = document.createElement('div');
        previewText.className = 'hm-preview';

        const updatePreviewText = () => {
            const days = parseInt(daysInput.value, 10);
            const notificationHour = hourInput.value || DEFAULT_NOTIFICATION_HOUR;
            if (Number.isNaN(days) || days < 1) {
                previewText.innerText = '\u05ea\u05d0\u05e8\u05d9\u05da \u05d4\u05ea\u05e8\u05d0\u05d4: -';
                return;
            }

            const previewDate = computeReminderDate(deadline, days, notificationHour);
            previewText.innerText = `\u05ea\u05d0\u05e8\u05d9\u05da \u05d4\u05ea\u05e8\u05d0\u05d4: ${formatReminderDateHeIL(previewDate)}`;
        };

        daysInput.addEventListener('input', updatePreviewText);
        hourInput.addEventListener('input', updatePreviewText);
        updatePreviewText();

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'hm-btn-add';
        addBtn.innerText = 'הוסף';
        addBtn.addEventListener('click', async () => {
            const days = parseInt(daysInput.value, 10);
            const notificationHour = hourInput.value || DEFAULT_NOTIFICATION_HOUR;
            if (isNaN(days) || days < 1 || days > 365) {
                alert('הזן מספר בין 1 ל-365 ימים');
                return;
            }

            if (!/^\d{2}:\d{2}$/.test(notificationHour)) {
                alert('בחר שעה תקינה');
                return;
            }

            if (
                existingNotifications.some(
                    (n) =>
                        n.daysBeforeDeadline === days &&
                        (n.notificationHour || DEFAULT_NOTIFICATION_HOUR) === notificationHour
                )
            ) {
                alert('התראה זו כבר קיימת');
                return;
            }

            const reminderDate = computeReminderDate(deadline, days, notificationHour);
            if (!reminderDate || reminderDate.getTime() <= Date.now()) {
                alert(
                    'לא ניתן להוסיף התראה לזמן שכבר עבר'
                );
                return;
            }

            const newNotification = {
                assignmentKey: uniqueKey,
                daysBeforeDeadline: days,
                notificationHour,
                reminderDate: reminderDate ? reminderDate.toISOString() : null,
                notified: false,
                createdAt: Date.now()
            };
            const assignment = pairs.find((p) => p.uniqueKey === uniqueKey);
            try {
                const newId = await client().saveNotification(newNotification, {
                    courseName,
                    exerciseName,
                    deadline,
                    time,
                    assignmentLink: assignment?.assignmentLink || ''
                });
                existingNotifications.push({ ...newNotification, id: newId });
                displayNotifications();
                daysInput.value = '';
                hourInput.value = DEFAULT_NOTIFICATION_HOUR;
                updatePreviewText();
                daysInput.focus();
            } catch (error) {
                alert(
                    '\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e9\u05de\u05d5\u05e8 \u05d4\u05ea\u05e8\u05d0\u05d4 \u05d6\u05d5. \u05d1\u05d3\u05d5\u05e7 \u05e9\u05d4\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05d4\u05e9\u05e2\u05d4 \u05e2\u05d3\u05d9\u05d9\u05df \u05e2\u05ea\u05d9\u05d3\u05d9\u05d9\u05dd.'
                );
            }
        });

        inputContainer.appendChild(daysInput);
        inputContainer.appendChild(hourInput);
        inputContainer.appendChild(addBtn);
        modal.appendChild(inputContainer);
        modal.appendChild(previewText);

        if (debug().getEnabled()) {
            const debugTestBtn = document.createElement('button');
            debugTestBtn.type = 'button';
            debugTestBtn.className = 'hm-btn-debug';
            debugTestBtn.innerText = 'בדוק התראה';
            debugTestBtn.addEventListener('click', () => {
                debug().log(`Testing notification for ${exerciseName}`);
                client().triggerChromeNotification(exerciseName, courseName, deadline, time);
                alert('נשלחה התראה');
            });
            modal.appendChild(debugTestBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'hm-btn-close-modal';
        closeBtn.innerText = 'סגור';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        modal.appendChild(closeBtn);

        document.body.appendChild(modal);
    }

    globalThis.HideMatalotNotificationSettingsModal = {
        displayNotificationSettings
    };
})();
