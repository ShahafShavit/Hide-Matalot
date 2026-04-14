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
        title.innerText = 'בחר מטלות להסתרה';
        title.style.marginBottom = '10px';
        container.appendChild(title);

        const debugContainer = document.createElement('div');
        debugContainer.style.textAlign = 'left';
        debugContainer.style.fontSize = 'smaller';
        debugContainer.style.position = 'absolute';
        debugContainer.style.top = '16px';
        debugContainer.style.left = '16px';
        const debugLabel = document.createElement('label');
        debugLabel.innerText = 'Debug';
        debugLabel.style.marginLeft = '5px';
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
                await modal().displayNotificationSettings(courseName, exerciseName, uniqueKey, deadline, time, pairs);
            });
            const calendarBtn = row.querySelector('button[data-action="calendar"]');
            calendarBtn.addEventListener('click', () => {
                if (!deadline) {
                    alert('לא נמצא תאריך הגשה למטלה זו');
                    return;
                }

                openGoogleCalendarEvent(courseName, exerciseName, deadline, time);
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
        button.id = 'manage-pairs-button';
        button.innerText = 'ניהול תצוגת מטלות (טוען...)';
        button.style.position = 'fixed';
        button.style.bottom = '10px';
        button.style.left = '10px';
        button.style.backgroundColor = '#6c757d';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.padding = '5px 10px';
        button.style.cursor = 'not-allowed';
        button.style.borderRadius = '3px';
        button.style.zIndex = '9999';
        button.disabled = true;

        button.addEventListener('click', () => {});

        document.body.appendChild(button);
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
