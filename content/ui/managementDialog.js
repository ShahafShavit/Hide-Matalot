(function () {
    'use strict';

    const storage = () => globalThis.HideMatalotIndexedDb;
    const parser = () => globalThis.HideMatalotAssignmentsParser;
    const modal = () => globalThis.HideMatalotNotificationSettingsModal;
    const debug = () => globalThis.HideMatalotContentDebug;

    let managementPairs = [];

    function buildGoogleCalendarUrl(courseName, exerciseName, deadline, time) {
        const dueDate = new Date(deadline * 1000);
        const [hours, minutes] = (time || '23:59').split(':').map((value) => parseInt(value, 10));

        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
            dueDate.setHours(hours, minutes, 0, 0);
        }

        const eventStart = new Date(dueDate);
        const eventEnd = new Date(dueDate.getTime() + 60 * 60 * 1000);

        const formatGoogleDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hour}${minute}${second}`;
        };

        const title = `דדליין הגשת: ${exerciseName}, ${courseName}`;
        const details = `\u05de\u05d8\u05dc\u05d4 \u05de\u05ea\u05d5\u05da Moodle\n\u05e7\u05d5\u05e8\u05e1: ${courseName}\n\u05de\u05d8\u05dc\u05d4: ${exerciseName}\n`;
        const query = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${formatGoogleDateTime(eventStart)}/${formatGoogleDateTime(eventEnd)}`,
            details: details,
            ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
        });

        return `https://calendar.google.com/calendar/render?${query.toString()}`;
    }

    function openGoogleCalendarEvent(courseName, exerciseName, deadline, time) {
        const url = buildGoogleCalendarUrl(courseName, exerciseName, deadline, time);
        debug().log(`Opening Google Calendar URL for ${exerciseName}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    async function displayDialoge(pairs) {
        if (document.getElementById('table-management')) return;

        const currentState = await storage().getSavedState();
        const container = document.createElement('div');
        container.id = 'table-management';
        container.className = 'hm-mgmt-panel';

        const title = document.createElement('h4');
        title.className = 'hm-mgmt-title';
        title.innerText = 'בחר מטלות להסתרה';
        container.appendChild(title);

        const debugContainer = document.createElement('div');
        debugContainer.className = 'hm-debug-corner';
        const debugLabel = document.createElement('label');
        debugLabel.innerText = 'Debug';
        const debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.checked = await storage().getSetting('debug');
        debugCheckbox.addEventListener('change', () => {
            storage().saveSetting('debug', debugCheckbox.checked);
            debug().setEnabled(debugCheckbox.checked);
        });
        debugContainer.appendChild(debugLabel);
        debugContainer.appendChild(debugCheckbox);

        container.appendChild(debugContainer);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'hm-close-panel';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(container);
        });
        container.appendChild(closeButton);

        const table = document.createElement('table');
        table.className = 'hm-table';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th class="hm-th">קורס</th>
            <th class="hm-th">מטלה</th>
            <th class="hm-th">התראות</th>
            <th class="hm-th">הוספה ליומן</th>
            <th class="hm-th">הסתר</th>
        `;
        table.appendChild(headerRow);

        pairs.forEach((pair) => {
            const { courseName, exerciseName, item, uniqueKey, legacyKey, deadline, time } = pair;
            const hidden = parser().resolveVisibilityFromState(currentState, uniqueKey, legacyKey) === false;

            const row = document.createElement('tr');

            const courseCell = document.createElement('td');
            courseCell.className = 'hm-td';
            courseCell.textContent = courseName;

            const exerciseCell = document.createElement('td');
            exerciseCell.className = 'hm-td';
            exerciseCell.textContent = exerciseName;

            const notifCell = document.createElement('td');
            notifCell.className = 'hm-td hm-td-center';
            const settingsBtn = document.createElement('button');
            settingsBtn.type = 'button';
            settingsBtn.dataset.action = 'notifications';
            settingsBtn.className = 'hm-icon-btn';
            settingsBtn.title = 'הגדר התראות';
            settingsBtn.textContent = '⚙️';
            notifCell.appendChild(settingsBtn);

            const calendarCell = document.createElement('td');
            calendarCell.className = 'hm-td hm-td-center';
            const calendarBtn = document.createElement('button');
            calendarBtn.type = 'button';
            calendarBtn.dataset.action = 'calendar';
            calendarBtn.className = 'hm-icon-btn hm-icon-btn--calendar';
            calendarBtn.title = 'הוסף ליומן Google';
            calendarBtn.textContent = '📅';
            calendarCell.appendChild(calendarBtn);

            const hideCell = document.createElement('td');
            hideCell.className = 'hm-td hm-td-center';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = hidden;
            hideCell.appendChild(checkbox);

            row.appendChild(courseCell);
            row.appendChild(exerciseCell);
            row.appendChild(notifCell);
            row.appendChild(calendarCell);
            row.appendChild(hideCell);

            settingsBtn.addEventListener('click', async () => {
                await modal().displayNotificationSettings(pair, pairs);
            });
            calendarBtn.addEventListener('click', () => {
                if (!deadline) {
                    alert('לא נמצא תאריך הגשה למטלה זו');
                    return;
                }

                openGoogleCalendarEvent(courseName, exerciseName, deadline, time);
            });
            checkbox.addEventListener('change', async () => {
                const isChecked = checkbox.checked;
                if (isChecked) {
                    item.style.display = 'none';
                    currentState[uniqueKey] = false;
                    if (legacyKey !== uniqueKey) {
                        delete currentState[legacyKey];
                    }
                } else {
                    item.style.display = '';
                    delete currentState[uniqueKey];
                    if (legacyKey !== uniqueKey) {
                        delete currentState[legacyKey];
                    }
                }
                await storage().saveState(currentState);
                parser().cleanUpDates();
            });
            table.appendChild(row);
        });
        container.appendChild(table);
        document.body.appendChild(container);
    }

    function addManagementButton() {
        if (document.getElementById('manage-pairs-button')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'manage-pairs-button';
        button.innerText = 'ניהול תצוגת מטלות (טוען...)';
        button.className = 'hm-float-btn hm-float-btn--loading';
        button.disabled = true;

        button.addEventListener('click', () => {});

        document.body.appendChild(button);
    }

    function activateManagementButton(pairs) {
        const button = document.getElementById('manage-pairs-button');
        if (!button) return;

        managementPairs = pairs;
        button.innerText = 'ניהול תצוגת מטלות';
        button.classList.remove('hm-float-btn--loading', 'hm-float-btn--error');
        button.classList.add('hm-float-btn--ready');
        button.disabled = false;
        button.onclick = () => {
            const el = document.getElementById('table-management');
            if (el) {
                document.body.removeChild(el);
            } else {
                displayDialoge(managementPairs);
            }
        };
    }

    globalThis.HideMatalotManagementDialog = {
        addManagementButton,
        activateManagementButton
    };
})();
