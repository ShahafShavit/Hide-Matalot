(function () {
    'use strict';

    const STORAGE_KEY = 'courseExerciseVisibility';

    function getSavedState() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function cleanUpState(pairs, savedState) {
        const activeKeys = new Set(pairs.map(pair => pair.uniqueKey));
        const updatedState = Object.fromEntries(
            Object.entries(savedState).filter(([key]) => activeKeys.has(key))
        );
        saveState(updatedState);
        return updatedState;
    }

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

    function extractCourseExercisePairs() {
        const items = document.querySelectorAll(".list-group-item.timeline-event-list-item");
        const pairs = [];
        const savedState = getSavedState();

        items.forEach(item => {
            const courseNameElement = item.querySelector(".event-name-container small");
            const exerciseNameElement = item.querySelector(".event-name-container a");

            if (courseNameElement && exerciseNameElement) {
                const courseName = courseNameElement.innerText.trim().replace("יש להגיש את 'מטלה' · ", "");
                const exerciseName = exerciseNameElement.innerText.trim();
                const uniqueKey = `${courseName}::${exerciseName}`;

                if (savedState[uniqueKey] === false) {
                    item.style.display = 'none';
                } else {
                    item.style.display = '';
                }

                pairs.push({ courseName, exerciseName, item, uniqueKey });
            }
        });

        return pairs;
    }

    function displayTable(pairs) {
        if (document.getElementById('table-management')) return;

        const savedState = getSavedState();

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

        const closeButton = document.createElement('button');
        closeButton.innerText = 'Close';
        closeButton.style.marginBottom = '10px';
        closeButton.style.backgroundColor = '#d9534f';
        closeButton.style.color = '#fff';
        closeButton.style.border = 'none';
        closeButton.style.padding = '5px 10px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.float = 'right';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(container);
        });
        container.appendChild(closeButton);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '10px';

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="border: 1px solid #ccc; padding: 5px; text-align: left;">הסתר</th>
            <th style="border: 1px solid #ccc; padding: 5px; text-align: left;">מטלה</th>
            <th style="border: 1px solid #ccc; padding: 5px; text-align: left;">קורס</th>
        `;
        table.appendChild(headerRow);

        pairs.forEach(({ courseName, exerciseName, item, uniqueKey }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">
                    <input type="checkbox" ${savedState[uniqueKey] === false ? 'checked' : ''}>
                </td>
                <td style="border: 1px solid #ccc; padding: 5px;">${exerciseName}</td>
                <td style="border: 1px solid #ccc; padding: 5px;">${courseName}</td>
            `;

            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', () => {
                const isChecked = checkbox.checked;
                if (isChecked) {
                    item.style.display = 'none';
                    savedState[uniqueKey] = false;
                } else {
                    item.style.display = '';
                    delete savedState[uniqueKey];
                }
                saveState(savedState);
                cleanUpDates(); // Re-evaluate dates after visibility change
            });

            table.appendChild(row);
        });

        container.appendChild(table);

        document.body.appendChild(container);
    }

    function addManagementButton(pairs) {
        if (document.getElementById('manage-pairs-button')) return;

        const button = document.createElement('button');
        button.id = 'manage-pairs-button';
        button.innerText = 'Manage Pairs';
        button.style.position = 'fixed';
        button.style.bottom = '10px';
        button.style.left = '10px';
        button.style.backgroundColor = '#007bff';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.padding = '5px 10px';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '3px';
        button.style.zIndex = '9999';

        button.addEventListener('click', () => {
            displayTable(pairs);
        });

        document.body.appendChild(button);
    }

    function init() {
        const pairs = extractCourseExercisePairs();
        const savedState = getSavedState();
        cleanUpState(pairs, savedState);
        cleanUpDates(); // Ensure unused dates are hidden initially
        addManagementButton(pairs);
    }

    function retryInit() {
        if (document.querySelector(".list-group-item.timeline-event-list-item")) {
            init();
        } else {
            setTimeout(retryInit, 500);
        }
    }

    retryInit();
})();
