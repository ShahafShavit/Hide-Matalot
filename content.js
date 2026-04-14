(function () {
    'use strict';

    // Check if this is a Moodle site
    if (!window.location.hostname.includes('moodle.')) {
        return;
    }

    let debugEnabled = false;
    let managementPairs = [];
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("ExerciseVisibilityDB", 2);
            request.onupgradeneeded = function (event) {
                const db = request.result;
                if (!db.objectStoreNames.contains("states")) {
                    db.createObjectStore("states", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("settings")) {
                    const settingStore = db.createObjectStore("settings", {autoIncrement: false});
                    settingStore.put(false, "debug");
                    settingStore.put(4, "initWaitTime");
                }
                if (!db.objectStoreNames.contains("notifications")) {
                    db.createObjectStore("notifications", { keyPath: "id" });
                }
            };
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    function saveToIndexedDB(data) {
        return openDatabase().then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction("states", "readwrite");
                const store = transaction.objectStore("states");
                store.put({ id: "visibilityState", data });
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        });
    }

    function getFromIndexedDB() {
        return openDatabase().then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction("states", "readonly");
                const store = transaction.objectStore("states");
                const request = store.get("visibilityState");
                request.onsuccess = function () {
                    resolve(request.result ? request.result.data : {});
                };
                request.onerror = reject;
            });
        });
    }

    async function saveState(state) {
        debugLog("Saving state to IndexedDB:", state);
        try {
            await saveToIndexedDB(state);
            debugLog("State saved successfully to IndexedDB.");
        } catch (error) {
            console.error("Error saving to IndexedDB:", error);
        }
    }



    function getSavedState() {
        return getFromIndexedDB().then(saved => {
            debugLog("Retrieved state from IndexedDB:", saved);
            return saved || {};
        });
    }

    async function getSetting(key) {
        debugLog(`Getting setting ${key} from DB`);
        try {
            const db = await openDatabase();
            const transaction = db.transaction("settings", "readonly");
            const store = transaction.objectStore("settings");
            const request = store.get(key);
    
            return await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    debugLog(`Successfuly pulled ${key}: ${request.result} from DB`);
                    resolve(request.result !== undefined ? request.result : null); // Return value or null if not found
                };
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`Error retrieving setting "${key}" from IndexedDB:`, error);
            return null; // Return null in case of any error
        }
    }

    
    async function saveSetting(key, value) {
        function saveSettingToIndexedDB(key, value) {
            return openDatabase().then(db => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction("settings", "readwrite");
                    const store = transaction.objectStore("settings");
                    const request = store.put(value, key); // Save value under the key
                    request.onsuccess = function () {
                        resolve(`Successfully saved key "${key}" with value.`);
                    };
                    request.onerror = function () {
                        reject(`Failed to save key "${key}": ${request.error}`);
                    };
                });
            });
        }
        debugLog(`Saving setting: "${key}":${value} to IndexedDB.`);
        try {
            await saveSettingToIndexedDB(key, value);
            debugLog("Setting saved successfully to IndexedDB.");
        } catch (error) {
            console.error("Error saving to IndexedDB:", error);
        }
    }

    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });
    }

    // Notification Management Functions
    async function saveNotification(notification, assignment) {
        try {
            const id = `${notification.assignmentKey}::${notification.daysBeforeDeadline}::${notification.notificationHour || '18:00'}::${Date.now()}`;
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
                type: 'SCHEDULE_ASSIGNMENT_NOTIFICATION',
                notification: payload
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to schedule notification');
            }

            debugLog('Notification scheduled:', id);
            return id;
        } catch (error) {
            console.error('Error saving notification:', error);
            throw error;
        }
    }

    async function getAllNotifications() {
        try {
            const result = await sendRuntimeMessage({ type: 'GET_SCHEDULED_NOTIFICATIONS' });
            if (!result?.success) {
                return [];
            }

            return Array.isArray(result.notifications) ? result.notifications : [];
        } catch (error) {
            console.error('Error fetching all notifications:', error);
            return [];
        }
    }

    async function getNotificationsForAssignment(assignmentKey) {
        const allNotifications = await getAllNotifications();
        return allNotifications.filter(notification => notification.assignmentKey === assignmentKey);
    }

    async function deleteNotification(notificationId) {
        try {
            const result = await sendRuntimeMessage({
                type: 'DELETE_ASSIGNMENT_NOTIFICATION',
                notificationId
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to delete notification');
            }

            debugLog('Notification deleted:', notificationId);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    async function cleanUpNotifications(pairs) {
        try {
            const allNotifications = await getAllNotifications();
            const activeKeys = new Set(pairs.map(p => p.uniqueKey));
            
            for (const notification of allNotifications) {
                if (!activeKeys.has(notification.assignmentKey)) {
                    await deleteNotification(notification.id);
                }
            }
            debugLog("Cleaned up stale notifications");
        } catch (error) {
            console.error("Error cleaning up notifications:", error);
        }
    }

    // Views and DOM handlers
    function cleanUpDates() {
        const dateElements = document.querySelectorAll('[data-region="event-list-content-date"]');
        dateElements.forEach(dateElement => {
            const siblingItems = dateElement.nextElementSibling.querySelectorAll(
                '.list-group-item.timeline-event-list-item'
            );

            const hasVisibleItems = Array.from(siblingItems).some(item => item.style.display !== 'none');

            if (!hasVisibleItems) {
                dateElement.style.display = 'none';
            } else {
                dateElement.style.display = '';
            }
        });
    }

    async function cleanUpState(pairs) {
        const savedState = await getSavedState(); 
        const activeKeys = new Set(pairs.map(pair => pair.uniqueKey));
        const updatedState = Object.fromEntries(
            Object.entries(savedState).filter(([key]) => activeKeys.has(key))
        );
        saveState(updatedState);
        await cleanUpNotifications(pairs);
        return updatedState;
    }

    async function extractCourseExercisePairs(currentState) {
        const items = document.querySelectorAll(".list-group-item.timeline-event-list-item");
        const pairs = [];
        let savedState = currentState; 

        items.forEach(item => {
            const courseNameElement = item.querySelector(".event-name-container small");
            const exerciseNameElement = item.querySelector(".event-name-container a");
            const timeElement = item.querySelector(".text-end.text-nowrap.align-self-center.ms-1");

            if (courseNameElement && exerciseNameElement) {
                const courseName = courseNameElement.innerText.trim().replace("יש להגיש את 'מטלה' · ", "");
                const exerciseName = exerciseNameElement.innerText.trim();
                const uniqueKey = `${courseName}::${exerciseName}`;
                const assignmentLink = exerciseNameElement.href || '';
                
                // Extract time (HH:MM format)
                const time = timeElement ? timeElement.innerText.trim() : "23:55";
                
                // Extract deadline timestamp from parent date header
                let deadline = null;
                let wrapper = item.closest('.pb-2') || item.closest('[data-region="event-list-wrapper"]');
                if (wrapper) {
                    const allDateHeaders = wrapper.querySelectorAll('[data-region="event-list-content-date"]');
                    for (let i = 0; i < allDateHeaders.length; i++) {
                        const currentList = allDateHeaders[i].nextElementSibling;
                        if (currentList && currentList.contains(item)) {
                            deadline = parseInt(allDateHeaders[i].getAttribute('data-timestamp'), 10);
                            break;
                        }
                    }
                }
                
                //console.log(savedState);
                if (savedState[uniqueKey] === false) {
                    item.style.display = 'none';
                } else {
                    item.style.display = '';
                }

                pairs.push({ courseName, exerciseName, item, uniqueKey, deadline, time, assignmentLink });
            }
        });

        return pairs;
    }

    
    function debugLog(...args) {
        if (debugEnabled) {
            const stack = new Error().stack;
            const caller = stack.split("\n")[2]?.trim() || "Unknown line";
            let callerLine = caller.split("/");
            callerLine = callerLine[callerLine.length - 1].replace(")","");
            // Include the caller's location in the log
            //console.trace("State retrieval trace");
            console.log(`[Debug] (${callerLine}):`, ...args);
        }
    }

    async function displayNotificationSettings(courseName, exerciseName, uniqueKey, deadline, time, pairs) {
        // Remove existing modal if any
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

        // Overlay background
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

        // Header
        const header = document.createElement('h5');
        header.innerText = `${exerciseName} - ${courseName}`;
        header.style.marginBottom = '15px';
        header.style.fontSize = '1rem';
        modal.appendChild(header);

        // Deadline info
        const deadlineInfo = document.createElement('div');
        deadlineInfo.style.marginBottom = '15px';
        deadlineInfo.style.fontSize = '0.85rem';
        deadlineInfo.style.color = '#666';
        const deadlineDate = deadline ? new Date(deadline * 1000).toLocaleDateString() : 'Unknown';
        deadlineInfo.innerText = `תאריך הגשה: ${deadlineDate} ${time}`;
        modal.appendChild(deadlineInfo);

        const getReminderDate = (daysBeforeDeadline, notificationHour) => {
            if (!deadline) return null;

            const reminderDate = new Date(deadline * 1000);
            reminderDate.setDate(reminderDate.getDate() - daysBeforeDeadline);

            const [hour, minute] = (notificationHour || '18:00').split(':').map(value => parseInt(value, 10));
            if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
                reminderDate.setHours(hour, minute, 0, 0);
            }

            return reminderDate;
        };

        const formatReminderDate = reminderDate => {
            if (!reminderDate) return 'לא ידוע';
            return `${reminderDate.toLocaleDateString('he-IL')} ${reminderDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        };

        // Notifications list
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

        // Load and display existing notifications
        const existingNotifications = await getNotificationsForAssignment(uniqueKey);
        const displayNotifications = () => {
            notificationsList.innerHTML = '';
            if (existingNotifications.length === 0) {
                const empty = document.createElement('p');
                empty.innerText = 'אין התראות';
                empty.style.color = '#666';
                empty.style.fontSize = '0.85rem';
                notificationsList.appendChild(empty);
            } else {
                existingNotifications.forEach(notif => {
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
                    const reminderDate = getReminderDate(notif.daysBeforeDeadline, notif.notificationHour);
                    notifText.innerText = `${notif.daysBeforeDeadline} יום לפני · ${formatReminderDate(reminderDate)}`;

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerText = '❌';
                    deleteBtn.style.backgroundColor = 'transparent';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.fontSize = '1rem';
                    deleteBtn.addEventListener('click', async () => {
                        await deleteNotification(notif.id);
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

        // Add notification section
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
        hourInput.value = '18:00';
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
            const notificationHour = hourInput.value || '18:00';
            if (Number.isNaN(days) || days < 1) {
                previewText.innerText = 'תאריך התראה: -';
                return;
            }

            const previewDate = getReminderDate(days, notificationHour);
            previewText.innerText = `תאריך התראה: ${formatReminderDate(previewDate)}`;
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
            const notificationHour = hourInput.value || '18:00';
            if (isNaN(days) || days < 1 || days > 365) {
                alert('הזן מספר בין 1 ל-365 ימים');
                return;
            }

            if (!/^\d{2}:\d{2}$/.test(notificationHour)) {
                alert('בחר שעה תקינה');
                return;
            }

            // Check for duplicate
            if (existingNotifications.some(n => n.daysBeforeDeadline === days && (n.notificationHour || '18:00') === notificationHour)) {
                alert('התראה זו כבר קיימת');
                return;
            }

            const reminderDate = getReminderDate(days, notificationHour);
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
            const assignment = pairs.find(pair => pair.uniqueKey === uniqueKey);
            try {
                const newId = await saveNotification(newNotification, {
                    courseName,
                    exerciseName,
                    deadline,
                    time,
                    assignmentLink: assignment?.assignmentLink || ''
                });
                existingNotifications.push({ ...newNotification, id: newId });
                displayNotifications();
                daysInput.value = '';
                hourInput.value = '18:00';
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

        // Debug test button (only if debug enabled)
        if (debugEnabled) {
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
                debugLog(`Testing notification for ${exerciseName}`);
                // Directly trigger a test notification
                triggerChromeNotification(exerciseName, courseName, deadline, time);
                alert('נשלחה התראה');
            });
            modal.appendChild(debugTestBtn);
        }

        // Close button
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

    async function displayDialoge(pairs) {
        if (document.getElementById('table-management')) return;
        
        const currentState = await getSavedState();
        const container = document.createElement('div');
        container.id = 'table-management';
        container.style.position = 'fixed';
        container.style.bottom = '10px';
        container.style.right = '10px';
        container.style.backgroundColor = '#f9f9f9';
        container.style.padding = '15px';
        container.style.border = '1px solid #ccc';
        container.style.zIndex = '9999';
        container.style.width = '500px';
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
        container.style.textAlign = 'center';

        const title = document.createElement('h4');
        title.innerText = 'בחר מטלות לביטול הצגתם';
        title.style.marginBottom = '10px';
        container.appendChild(title);

        // Add Debug Checkbox
        const debugContainer = document.createElement('div');
        debugContainer.style.textAlign = 'left';
        debugContainer.style.fontSize = 'smaller';
        debugContainer.style.position = 'absolute';
        debugContainer.style.top = '16px';
        debugContainer.style.left = '16px';
        const debugLabel = document.createElement('label');
        debugLabel.innerText = "Debug";
        debugLabel.style.marginLeft = '5px';
        const debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.checked = await getSetting("debug");//debugEnabled ?? false;
        debugCheckbox.addEventListener('change', () => {
            saveSetting("debug", debugCheckbox.checked);
            debugEnabled = debugCheckbox.checked;
            
        });
        debugContainer.appendChild(debugLabel);
        debugContainer.appendChild(debugCheckbox);

        container.appendChild(debugContainer);

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '15px';
        closeButton.style.backgroundColor = 'transparent';
        closeButton.style.color = '#d9534f';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '30px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.lineHeight = '1';
        closeButton.style.fontWeight = 'bold';
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.color = '#c9302c';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.color = '#d9534f';
        });
        closeButton.addEventListener('click', () => {
            document.body.removeChild(container);
        });
        container.appendChild(closeButton);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '10px';
        table.style.lineHeight = '1';
        table.style.fontSize = '0.9rem';
        const headerRow = document.createElement('tr');
        const padding = 2;
        headerRow.innerHTML = `
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">קורס</th>
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">מטלה</th>
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">התראות</th>
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">הוספה ליומן</th>
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">הסתר</th>
        `;
        table.appendChild(headerRow);

        pairs.forEach(({ courseName, exerciseName, item, uniqueKey, deadline, time }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: ${padding}px;">${courseName}</td>
                <td style="border: 1px solid #ccc; padding: ${padding}px;">${exerciseName}</td>
                <td style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">
                    <button data-action="notifications" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="הגדר התראות">⚙️</button>
                </td>
                <td style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">
                    <button data-action="calendar" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="הוסף ליומן Google">📅</button>
                </td>
                <td style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">
                    <input type="checkbox" ${currentState[uniqueKey] === false ? 'checked' : ''}>
                </td>
            `;
            const settingsBtn = row.querySelector('button[data-action="notifications"]');
            settingsBtn.addEventListener('click', async () => {
                await displayNotificationSettings(courseName, exerciseName, uniqueKey, deadline, time, pairs);
            });
            const calendarBtn = row.querySelector('button[data-action="calendar"]');
            calendarBtn.addEventListener('click', () => {
                if (!deadline) {
                    alert('לא נמצא תאריך הגשה למטלה זו');
                    return;
                }

                showCalendarMenu(courseName, exerciseName, deadline, time, calendarBtn);
            });
            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', async () => {
                const isChecked = checkbox.checked;
                if (isChecked) {
                    item.style.display = 'none';
                    currentState[uniqueKey] = false;
                } else {
                    item.style.display = '';
                    delete currentState[uniqueKey];
                }
                await saveState(currentState);
                cleanUpDates(); // Re-evaluate dates after visibility change
            });
            table.appendChild(row);
        });
        container.appendChild(table);
        document.body.appendChild(container);
    }

    function triggerChromeNotification(exerciseName, courseName, deadline, time) {
        try {
            const deadlineDate = new Date(deadline * 1000);
            const formattedDate = deadlineDate.toLocaleDateString('he-IL');
            
            const message = `${exerciseName} ב${courseName} עד ${formattedDate} ${time}`;
            
                console.log("[Content] Sending notification request to background worker:", { exerciseName, courseName, formattedDate, time });
            
                // Send message to background service worker to create notification
                chrome.runtime.sendMessage(
                    {
                        type: 'CREATE_NOTIFICATION',
                        title: 'תזכורת להגשת מטלה',
                        message: message,
                        iconUrl: chrome.runtime.getURL('hide128.png')
                    },
                    (response) => {
                        if (response && response.success) {
                            console.log("[Content] Notification created with ID:", response.notificationId);
                            debugLog(`Notification created: ${response.notificationId}`);
                        } else {
                            console.error("[Content] Notification failed:", response?.error);
                            debugLog(`Notification failed: ${response?.error}`);
                        }
                    }
                );
        } catch (error) {
            console.error("Error triggering Chrome notification:", error);
                debugLog(`Error triggering notification: ${error.message}`);
        }
    }

    function buildGoogleCalendarUrl(courseName, exerciseName, deadline, time) {
        const dueDate = new Date(deadline * 1000);
        const [hours, minutes] = (time || '23:59').split(':').map(value => parseInt(value, 10));

        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
            dueDate.setHours(hours, minutes, 0, 0);
        }

        const eventStart = new Date(dueDate);
        const eventEnd = new Date(dueDate.getTime() + 60 * 60 * 1000);

        const formatGoogleDateTime = date => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hour}${minute}${second}`;
        };

        const title = `דדליין הגשת: ${exerciseName}, ${courseName}`;
        const details = `מטלה מתוך Moodle\nקורס: ${courseName}\nמטלה: ${exerciseName}\n`;
        const query = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${formatGoogleDateTime(eventStart)}/${formatGoogleDateTime(eventEnd)}`,
            details: details,
            ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
        });

        return `https://calendar.google.com/calendar/render?${query.toString()}`;
    }

    function buildMicrosoftCalendarUrl(courseName, exerciseName, deadline, time) {
        const dueDate = new Date(deadline * 1000);
        const [hours, minutes] = (time || '23:59').split(':').map(value => parseInt(value, 10));

        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
            dueDate.setHours(hours, minutes, 0, 0);
        }

        const title = `דדליין הגשת: ${exerciseName}, ${courseName}`;
        const body = `מטלה מתוך Moodle\nקורס: ${courseName}\nמטלה: ${exerciseName}`;
        
        const query = new URLSearchParams({
            subject: title,
            startdt: dueDate.toISOString(),
            enddt: new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString(),
            body: body,
            location: 'Moodle'
        });

        return `https://outlook.live.com/calendar/0/deeplink/compose?${query.toString()}`;
    }

    function showCalendarMenu(courseName, exerciseName, deadline, time, button) {
        // Remove existing menu if any
        const existingMenu = document.querySelector('#calendar-menu-popup');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create menu
        const menu = document.createElement('div');
        menu.id = 'calendar-menu-popup';
        menu.style.position = 'fixed';
        menu.style.backgroundColor = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '5px';
        menu.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        menu.style.zIndex = '10001';
        menu.style.minWidth = '200px';
        menu.style.padding = '8px 0';

        const rect = button.getBoundingClientRect();
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.left = (rect.left - 50) + 'px';

        // Google Calendar option
        const googleCalOption = document.createElement('div');
        googleCalOption.style.padding = '10px 15px';
        googleCalOption.style.cursor = 'pointer';
        googleCalOption.style.fontSize = '14px';
        googleCalOption.style.color = '#333';
        googleCalOption.innerText = '📅 Google Calendar';
        googleCalOption.addEventListener('mouseover', () => {
            googleCalOption.style.backgroundColor = '#f0f0f0';
        });
        googleCalOption.addEventListener('mouseout', () => {
            googleCalOption.style.backgroundColor = 'transparent';
        });
        googleCalOption.addEventListener('click', () => {
            openGoogleCalendarEvent(courseName, exerciseName, deadline, time);
            menu.remove();
        });

        // Microsoft Outlook option
        const outlookOption = document.createElement('div');
        outlookOption.style.padding = '10px 15px';
        outlookOption.style.cursor = 'pointer';
        outlookOption.style.fontSize = '14px';
        outlookOption.style.color = '#333';
        outlookOption.innerText = '📅 Microsoft Outlook';
        outlookOption.addEventListener('mouseover', () => {
            outlookOption.style.backgroundColor = '#f0f0f0';
        });
        outlookOption.addEventListener('mouseout', () => {
            outlookOption.style.backgroundColor = 'transparent';
        });
        outlookOption.addEventListener('click', () => {
            openMicrosoftCalendarEvent(courseName, exerciseName, deadline, time);
            menu.remove();
        });

        menu.appendChild(googleCalOption);
        menu.appendChild(outlookOption);

        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== button) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }

    function openGoogleCalendarEvent(courseName, exerciseName, deadline, time) {
        const url = buildGoogleCalendarUrl(courseName, exerciseName, deadline, time);
        debugLog(`Opening Google Calendar URL for ${exerciseName}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function openMicrosoftCalendarEvent(courseName, exerciseName, deadline, time) {
        const url = buildMicrosoftCalendarUrl(courseName, exerciseName, deadline, time);
        debugLog(`Opening Microsoft Outlook URL for ${exerciseName}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function ensureFloatingControls() {
        let container = document.getElementById('floating-controls-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'floating-controls-container';
            container.style.position = 'fixed';
            container.style.bottom = '10px';
            container.style.right = '10px';
            container.style.display = 'flex';
            container.style.gap = '8px';
            container.style.alignItems = 'center';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }

        let manageButton = document.getElementById('manage-pairs-button');
        if (!manageButton) {
            manageButton = document.createElement('button');
            manageButton.id = 'manage-pairs-button';
            manageButton.innerText = 'ניהול תצוגת מטלות (טוען...)';
            manageButton.style.backgroundColor = '#6c757d';
            manageButton.style.color = '#fff';
            manageButton.style.border = 'none';
            manageButton.style.padding = '5px 10px';
            manageButton.style.cursor = 'not-allowed';
            manageButton.style.borderRadius = '3px';
            manageButton.disabled = true;
            manageButton.addEventListener('click', () => {
                // Disabled while loading.
            });
            container.appendChild(manageButton);
        }

        let timelineButton = document.getElementById('jump-to-timeline-button');
        if (!timelineButton) {
            timelineButton = document.createElement('button');
            timelineButton.id = 'jump-to-timeline-button';
            timelineButton.innerText = 'קפיצה למטלות';
            timelineButton.style.backgroundColor = '#28a745';
            timelineButton.style.color = '#fff';
            timelineButton.style.border = 'none';
            timelineButton.style.padding = '5px 10px';
            timelineButton.style.cursor = 'pointer';
            timelineButton.style.borderRadius = '3px';
            timelineButton.addEventListener('click', jumpToTimelineSection);
            container.appendChild(timelineButton);
        }
    }

    function addManagementButton() {
        ensureFloatingControls();
    }

    function jumpToTimelineSection() {
        const scrollToTimeline = () => {
            const timelineBlock = document.querySelector('.block-timeline');
            if (timelineBlock) {
                timelineBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (typeof timelineBlock.focus === 'function') {
                    timelineBlock.setAttribute('tabindex', '-1');
                    timelineBlock.focus({ preventScroll: true });
                }
                return true;
            }
            return false;
        };

        if (scrollToTimeline()) {
            return;
        }

        const observer = new MutationObserver(() => {
            if (scrollToTimeline()) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 10000);
    }

    function activateManagementButton(pairs) {
        const button = document.getElementById('manage-pairs-button');
        if (!button) return;

        managementPairs = pairs;
        button.innerText = 'ניהול תצוגת מטלות';
        button.style.backgroundColor = '#007bff';
        button.style.cursor = 'pointer';
        button.disabled = false;
        button.onclick = () => {
            const container = document.getElementById("table-management");
            if (container) {
                document.body.removeChild(container);
            } else {
                displayDialoge(managementPairs);
            }
        };
    }
    
    async function clickViewMoreButton() {
        const targetText = "הצגת פעילויות נוספות"; 
        let found = false;

        while (true) {
            const buttons = document.querySelectorAll(".btn.btn-secondary");
            for (const button of buttons) {
                if (button.innerText.trim() === targetText) {
                    debugLog(`Found button with text "${targetText}". Clicking...`);
                    button.click();
                    found = true;
                    break;
                }
            }

            if (!found) {
                debugLog("No 'View More Events' button found.");
                break;
            }
            else {
                break;
            }
        }
    }

    async function init() {
        try {
            addManagementButton();

            const timeoutSeconds = await getSetting("initWaitTime");
            debugEnabled = await getSetting("debug");
            if (debugEnabled) debugLog("Debug mode is enabled. You can disable it in the dialoge.");
            debugLog("Fetching Init saved state...");
            let currentState = await getSavedState();

            debugLog(`Waiting for ${timeoutSeconds} seconds before starting...`);
            await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000)); // Initial delay

            debugLog("Waiting for 'View More Events' buttons to complete...");
            await clickViewMoreButton();
            await new Promise(resolve => setTimeout(resolve, 1500));

            debugLog("Extracting course-exercise pairs...");
            let pairs = await extractCourseExercisePairs(currentState);

            debugLog(`Fetched total of ${pairs.length} assingnments.`);
            debugLog(`Verifying integrity of pulling of assignments...`);
            await new Promise(resolve => setTimeout(resolve, 800));
            const pairsCheck = await extractCourseExercisePairs(currentState);
            if (pairs.length < pairsCheck.length) {
                debugLog("Integrity check failed, using lastest pull.");
                pairs = pairsCheck;
            }
            else {
                debugLog("Integrity verification passed...");
            }

            
            

            debugLog("Cleaning up state...");
            cleanUpState(pairs);

            debugLog("Cleaning up /dates/...");
            cleanUpDates();

            debugLog("Activating management button...");
            activateManagementButton(pairs);
        } catch (error) {
            console.error("Initialization error:", error);
            const button = document.getElementById('manage-pairs-button');
            if (button) {
                button.innerText = 'ניהול תצוגת מטלות (שגיאה בטעינה)';
                button.style.backgroundColor = '#d9534f';
                button.style.cursor = 'not-allowed';
                button.disabled = true;
            }
        }
    }

    init();
})();
