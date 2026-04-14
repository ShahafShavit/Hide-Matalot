(function () {
    'use strict';

    const {
        DEFAULT_NOTIFICATION_HOUR,
        computeReminderDate,
        formatReminderDateHeIL
    } = globalThis.HideMatalotReminderTime;

    const client = () => globalThis.HideMatalotRuntimeClient;
    const debug = () => globalThis.HideMatalotContentDebug;

    async function displayNotificationSettings(courseName, exerciseName, uniqueKey, deadline, time, pairs) {
        const existing = document.getElementById('notification-settings-modal');
        if (existing) document.body.removeChild(existing);

        const modal = document.createElement('div');
        modal.id = 'notification-settings-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = '#fff';
        modal.style.padding = '20px';
        modal.style.border = '1px solid #ccc';
        modal.style.borderRadius = '5px';
        modal.style.zIndex = '10000';
        modal.style.width = '400px';
        modal.style.maxHeight = '500px';
        modal.style.overflowY = 'auto';
        modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9999';
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        document.body.appendChild(overlay);

        const header = document.createElement('h5');
        header.innerText = `${exerciseName} - ${courseName}`;
        header.style.marginBottom = '15px';
        header.style.fontSize = '1rem';
        modal.appendChild(header);

        const deadlineInfo = document.createElement('div');
        deadlineInfo.style.marginBottom = '15px';
        deadlineInfo.style.fontSize = '0.85rem';
        deadlineInfo.style.color = '#666';
        const deadlineDate = deadline ? new Date(deadline * 1000).toLocaleDateString() : 'Unknown';
        deadlineInfo.innerText = `תאריך הגשה: ${deadlineDate} ${time}`;
        modal.appendChild(deadlineInfo);

        const listHeader = document.createElement('div');
        listHeader.innerText = 'התראות קיימות:';
        listHeader.style.marginBottom = '10px';
        listHeader.style.fontWeight = 'bold';
        listHeader.style.fontSize = '0.9rem';
        listHeader.style.color = '#666';
        modal.appendChild(listHeader);

        const notificationsList = document.createElement('div');
        notificationsList.id = 'notifications-list';
        notificationsList.style.marginBottom = '15px';
        notificationsList.style.minHeight = '30px';
        notificationsList.style.maxHeight = '200px';
        notificationsList.style.overflowY = 'auto';
        notificationsList.style.color = '#666';
        modal.appendChild(notificationsList);

        const existingNotifications = await client().getNotificationsForAssignment(uniqueKey);
        const displayNotifications = () => {
            notificationsList.innerHTML = '';
            if (existingNotifications.length === 0) {
                const empty = document.createElement('p');
                empty.innerText = 'אין התראות';
                empty.style.color = '#666';
                empty.style.fontSize = '0.85rem';
                notificationsList.appendChild(empty);
            } else {
                existingNotifications.forEach((notif) => {
                    const notifRow = document.createElement('div');
                    notifRow.style.display = 'flex';
                    notifRow.style.justifyContent = 'space-between';
                    notifRow.style.alignItems = 'center';
                    notifRow.style.marginBottom = '8px';
                    notifRow.style.padding = '8px';
                    notifRow.style.backgroundColor = '#f5f5f5';
                    notifRow.style.borderRadius = '3px';
                    notifRow.style.fontSize = '0.9rem';
                    notifRow.style.gap = '8px';

                    const notifText = document.createElement('span');
                    const reminderDate = computeReminderDate(deadline, notif.daysBeforeDeadline, notif.notificationHour);
                    notifText.innerText = `${notif.daysBeforeDeadline} יום לפני · ${formatReminderDateHeIL(reminderDate)}`;

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerText = '\u274C';
                    deleteBtn.style.backgroundColor = 'transparent';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.fontSize = '1rem';
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
        addHeader.innerText = 'הוסף התראה חדשה:';
        addHeader.style.marginBottom = '10px';
        addHeader.style.fontWeight = 'bold';
        addHeader.style.fontSize = '0.9rem';
        addHeader.style.color = '#666';
        modal.appendChild(addHeader);

        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '8px';
        inputContainer.style.marginBottom = '15px';
        inputContainer.style.alignItems = 'center';

        const daysInput = document.createElement('input');
        daysInput.type = 'number';
        daysInput.min = '1';
        daysInput.max = '365';
        daysInput.placeholder = 'ימים לפני הדדליין';
        daysInput.style.flex = '1';
        daysInput.style.padding = '6px';
        daysInput.style.border = '1px solid #ccc';
        daysInput.style.borderRadius = '3px';
        daysInput.style.fontSize = '0.9rem';

        const hourInput = document.createElement('input');
        hourInput.type = 'time';
        hourInput.value = DEFAULT_NOTIFICATION_HOUR;
        hourInput.step = '60';
        hourInput.style.width = '110px';
        hourInput.style.padding = '6px';
        hourInput.style.border = '1px solid #ccc';
        hourInput.style.borderRadius = '3px';
        hourInput.style.fontSize = '0.9rem';

        const previewText = document.createElement('div');
        previewText.style.marginBottom = '10px';
        previewText.style.fontSize = '0.85rem';
        previewText.style.color = '#666';

        const updatePreviewText = () => {
            const days = parseInt(daysInput.value, 10);
            const notificationHour = hourInput.value || DEFAULT_NOTIFICATION_HOUR;
            if (Number.isNaN(days) || days < 1) {
                previewText.innerText = 'תאריך התראה: -';
                return;
            }

            const previewDate = computeReminderDate(deadline, days, notificationHour);
            previewText.innerText = `תאריך התראה: ${formatReminderDateHeIL(previewDate)}`;
        };

        daysInput.addEventListener('input', updatePreviewText);
        hourInput.addEventListener('input', updatePreviewText);
        updatePreviewText();

        const addBtn = document.createElement('button');
        addBtn.innerText = 'הוסף';
        addBtn.style.padding = '6px 12px';
        addBtn.style.backgroundColor = '#28a745';
        addBtn.style.color = '#fff';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '3px';
        addBtn.style.cursor = 'pointer';
        addBtn.style.fontSize = '0.9rem';
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
                alert('לא ניתן להוסיף התראה לזמן שכבר עבר');
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
            const assignment = pairs.find((pair) => pair.uniqueKey === uniqueKey);
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
                alert('לא ניתן לשמור התראה זו. בדוק שהתאריך והשעה עדיין עתידיים.');
            }
        });

        inputContainer.appendChild(daysInput);
        inputContainer.appendChild(hourInput);
        inputContainer.appendChild(addBtn);
        modal.appendChild(inputContainer);
        modal.appendChild(previewText);

        if (debug().getEnabled()) {
            const debugTestBtn = document.createElement('button');
            debugTestBtn.innerText = 'בדוק התראה';
            debugTestBtn.style.width = '100%';
            debugTestBtn.style.padding = '8px';
            debugTestBtn.style.marginBottom = '10px';
            debugTestBtn.style.backgroundColor = '#6c757d';
            debugTestBtn.style.color = '#000';
            debugTestBtn.style.borderRadius = '3px';
            debugTestBtn.style.cursor = 'pointer';
            debugTestBtn.style.fontSize = '0.9rem';
            debugTestBtn.style.fontWeight = 'bold';
            debugTestBtn.addEventListener('click', () => {
                debug().log(`Testing notification for ${exerciseName}`);
                client().triggerChromeNotification(exerciseName, courseName, deadline, time);
                alert('נשלחה התראה');
            });
            modal.appendChild(debugTestBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'סגור';
        closeBtn.style.width = '100%';
        closeBtn.style.padding = '10px';
        closeBtn.style.backgroundColor = '#6c757d';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '3px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '0.9rem';
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
