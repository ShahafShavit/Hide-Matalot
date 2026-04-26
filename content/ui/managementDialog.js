(function () {
    'use strict';

    const storage = () => globalThis.HideMatalotIndexedDb;
    const parser = () => globalThis.HideMatalotAssignmentsParser;
    const modal = () => globalThis.HideMatalotNotificationSettingsModal;
    const debug = () => globalThis.HideMatalotContentDebug;
    const client = () => globalThis.HideMatalotRuntimeClient;
    
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

    function buildMicrosoftCalendarUrl(courseName, exerciseName, deadline, time) {
        const dueDate = new Date(deadline * 1000);
        const [hours, minutes] = (time || '23:59').split(':').map((value) => parseInt(value, 10));

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

    function openGoogleCalendarEvent(courseName, exerciseName, deadline, time) {
        const url = buildGoogleCalendarUrl(courseName, exerciseName, deadline, time);
        debug().log(`Opening Google Calendar URL for ${exerciseName}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function openMicrosoftCalendarEvent(courseName, exerciseName, deadline, time) {
        const url = buildMicrosoftCalendarUrl(courseName, exerciseName, deadline, time);
        debug().log(`Opening Microsoft Outlook URL for ${exerciseName}`);
        window.open(url, '_blank', 'noopener,noreferrer');
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
        menu.className = 'hm-calendar-menu';

        const rect = button.getBoundingClientRect();
        menu.style.top = rect.bottom + 5 + 'px';
        menu.style.left = rect.left - 50 + 'px';

        // Google Calendar option
        const googleCalOption = document.createElement('div');
        googleCalOption.className = 'hm-calendar-menu-item';
        googleCalOption.innerText = '📅 Google Calendar';
        googleCalOption.addEventListener('click', () => {
            openGoogleCalendarEvent(courseName, exerciseName, deadline, time);
            menu.remove();
        });

        // Microsoft Outlook option
        const outlookOption = document.createElement('div');
        outlookOption.className = 'hm-calendar-menu-item';
        outlookOption.innerText = '📅 Microsoft Outlook';
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

    function createMockTimelineItem(assignment) {
        const mockItem = document.createElement('div');
        mockItem.className = 'list-group-item timeline-event-list-item flex-column pt-2 pb-0 border-0 px-2 hm-mock-assignment';
        mockItem.setAttribute('data-hm-mock', 'true');

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex flex-wrap pb-1';

        const timelineName = document.createElement('div');
        timelineName.className = 'd-flex me-auto pb-1 mw-100 timeline-name';

        const timeSmall = document.createElement('small');
        timeSmall.className = 'text-end text-nowrap align-self-center ms-1';
        timeSmall.innerText = assignment.time;

        const iconContainer = document.createElement('div');
        iconContainer.className = 'activityiconcontainer small align-self-top align-self-center mx-3 mb-1 mb-sm-0 text-nowrap';
        iconContainer.textContent = '📋';

        const eventNameContainer = document.createElement('div');
        eventNameContainer.className = 'event-name-container flex-grow-1 line-height-3 nowrap text-truncate';

        const nameRow = document.createElement('div');
        nameRow.className = 'd-flex';
        const heading = document.createElement('h6');
        heading.className = 'event-name mb-0 pb-1 text-truncate';
        const exerciseLink = document.createElement('a');
        exerciseLink.href = assignment.assignmentLink;
        exerciseLink.title = assignment.exerciseName;
        exerciseLink.innerText = assignment.exerciseName;
        exerciseLink.addEventListener('click', (e) => {
            if (assignment.assignmentLink === '#') {
                e.preventDefault();
            }
        });
        heading.appendChild(exerciseLink);
        nameRow.appendChild(heading);

        const courseSmall = document.createElement('small');
        courseSmall.className = 'mb-0';
        courseSmall.innerText = `יש להגיש את 'מטלה' · ${assignment.courseName}`;

        eventNameContainer.appendChild(nameRow);
        eventNameContainer.appendChild(courseSmall);

        timelineName.appendChild(timeSmall);
        timelineName.appendChild(iconContainer);
        timelineName.appendChild(eventNameContainer);

        const actionCol = document.createElement('div');
        actionCol.className = 'd-flex timeline-action-button';
        const actionH6 = document.createElement('h6');
        actionH6.className = 'event-action';
        const actionBtn = document.createElement('a');
        actionBtn.className = 'list-group-item-action btn btn-outline-secondary btn-sm text-nowrap';
        actionBtn.href = '#';
        actionBtn.innerText = 'הוספת הגשה';
        actionBtn.addEventListener('click', (e) => e.preventDefault());
        actionH6.appendChild(actionBtn);
        actionCol.appendChild(actionH6);

        wrapper.appendChild(timelineName);
        wrapper.appendChild(actionCol);
        mockItem.appendChild(wrapper);

        const divider = document.createElement('div');
        divider.className = 'pt-2 border-bottom';
        mockItem.appendChild(divider);

        return mockItem;
    }

    function getOrCreateDateListGroup(eventListContent, deadlineTs) {
        const wrapper = eventListContent.querySelector('[data-region="event-list-wrapper"]');
        if (!wrapper) return null;

        const existingDateHeaders = wrapper.querySelectorAll('[data-region="event-list-content-date"]');
        for (const header of existingDateHeaders) {
            const headerTs = parseInt(header.getAttribute('data-timestamp') || '', 10);
            if (Number.isNaN(headerTs)) continue;
            if (headerTs === deadlineTs) {
                const listGroup = header.nextElementSibling;
                if (listGroup && listGroup.classList.contains('list-group')) {
                    return listGroup;
                }
            }
        }

        const dateHeader = document.createElement('div');
        dateHeader.className = 'mt-3';
        dateHeader.setAttribute('data-region', 'event-list-content-date');
        dateHeader.setAttribute('data-timestamp', String(deadlineTs));
        dateHeader.setAttribute('data-hm-mock-section', 'true');

        const title = document.createElement('h5');
        title.className = 'h6 d-inline font-weight-bold px-2';
        title.innerText = new Date(deadlineTs * 1000).toLocaleDateString('he-IL');
        dateHeader.appendChild(title);

        const listGroup = document.createElement('div');
        listGroup.className = 'list-group list-group-flush';
        listGroup.setAttribute('data-hm-mock-section', 'true');

        wrapper.appendChild(dateHeader);
        wrapper.appendChild(listGroup);
        return listGroup;
    }

    function hasMockAssignments() {
        return !!document.querySelector('.hm-mock-assignment');
    }

    function removeMockAssignments() {
        const mockItems = document.querySelectorAll('.hm-mock-assignment');
        mockItems.forEach((item) => item.remove());

        const mockDateHeaders = document.querySelectorAll('[data-region="event-list-content-date"][data-hm-mock-section="true"]');
        mockDateHeaders.forEach((header) => {
            const listGroup = header.nextElementSibling;
            if (listGroup && listGroup.getAttribute('data-hm-mock-section') === 'true') {
                listGroup.remove();
            }
            header.remove();
        });

        parser().cleanUpDates();
    }

    function addMockAssignments() {
        const eventListContent = document.querySelector('[data-region="event-list-content"]');
        if (!eventListContent) {
            alert('לא נמצא אזור המטלות באתר');
            return false;
        }

        if (hasMockAssignments()) {
            alert('כבר נוספו מטלות mock בעמוד הזה');
            return true;
        }

        const nowTs = Math.floor(Date.now() / 1000);
        const mockAssignments = [
            {
                courseName: 'קורס טסט 1',
                exerciseName: 'מטלה Mock 1',
                deadline: nowTs + 86400,
                time: '23:55',
                assignmentLink: '#'
            },
            {
                courseName: 'קורס טסט 2',
                exerciseName: 'מטלה Mock 2',
                deadline: nowTs + 86400 * 2,
                time: '18:00',
                assignmentLink: '#'
            },
            {
                courseName: 'קורס טסט 3',
                exerciseName: 'מטלה Mock 3',
                deadline: nowTs + 86400 * 3,
                time: '12:00',
                assignmentLink: '#'
            }
        ];

        mockAssignments.forEach((assignment) => {
            const targetList = getOrCreateDateListGroup(eventListContent, assignment.deadline);
            if (!targetList) return;
            const mockItem = createMockTimelineItem(assignment);
            targetList.insertBefore(mockItem, targetList.firstChild);
        });

        return true;
    }

    async function displayDialoge(pairs) {
        if (document.getElementById('table-management')) return;

        const currentState = await storage().getSavedState();
        const container = document.createElement('div');
        container.id = 'table-management';
        container.className = 'hm-mgmt-panel';

        const title = document.createElement('h4');
        title.className = 'hm-mgmt-title';
        title.innerText = 'מנהל תצוגת קורסים';
        container.appendChild(title);

        const debugContainer = document.createElement('div');
        debugContainer.className = 'hm-debug-corner';
        const debugLabel = document.createElement('label');
        debugLabel.innerText = 'Debug';
        const debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.checked = !!(await storage().getSetting('debug'));
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

        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.className = 'hm-export-btn';
        exportButton.innerHTML = '📥';
        exportButton.title = 'ייצוא (CSV)'
        exportButton.addEventListener('click', () => {
            if (!managementPairs) {
                return;
            }

            // Use managementPairs or pairs?
            const noneHiddenMatalot = managementPairs.filter(
                ({ uniqueKey, legacyKey }) => parser().resolveVisibilityFromState(currentState, uniqueKey, legacyKey) !== false
            )
            client().downloadMatalotCsv(noneHiddenMatalot)
            
        });
        container.appendChild(exportButton);

        const settingsShowCountdown = !!(await storage().getSetting('showCountdown'));
        const countdownCheckboxContainer = document.createElement('div');
        countdownCheckboxContainer.className = 'hm-countdown-checkbox-container';

        const countdownCheckboxLabel = document.createElement('label');
        countdownCheckboxLabel.innerText = 'ספירה לאחור';

        const countdownCheckbox = document.createElement('input');
        countdownCheckbox.type='checkbox';
        countdownCheckbox.title='ספירה לאחור';
        countdownCheckbox.checked = settingsShowCountdown
        
        countdownCheckboxContainer.appendChild(countdownCheckboxLabel)
        countdownCheckboxContainer.appendChild(countdownCheckbox)
        countdownCheckbox.addEventListener('change', (e) => {
            const checked = e.target?.checked;
            storage().saveSetting('showCountdown', checked);
            if (checked)
                showCountdown();
            else {
                const headerNodes = document.querySelectorAll('[data-timestamp].mt-3');
                headerNodes?.forEach(el => el.dataset.mtCountdown = '');
            }
        });
        container.appendChild(countdownCheckboxContainer);

        
        
        const mockBtn = document.createElement('button');
        mockBtn.type = 'button';
        mockBtn.id = 'add-mock-assignments-btn';
        mockBtn.className = 'hm-btn-debug';
        mockBtn.innerText = hasMockAssignments() ? 'מחק את 3 מטלות הבדיקה' : 'הוסף 3 מטלות בדיקה';
        mockBtn.style.marginTop = '10px';
        mockBtn.style.display = debugCheckbox.checked ? 'block' : 'none';
        mockBtn.addEventListener('click', async () => {
            if (hasMockAssignments()) {
                removeMockAssignments();
            } else {
                const created = addMockAssignments();
                if (!created) return;
            }

            const savedState = await storage().getSavedState();
            managementPairs = parser().extractCourseExercisePairs(savedState);
            // Reload the dialog to show new mock assignments
            document.body.removeChild(container);
            displayDialoge(managementPairs);
        });
        container.appendChild(mockBtn);

        debugCheckbox.addEventListener('change', () => {
            storage().saveSetting('debug', debugCheckbox.checked);
            debug().setEnabled(debugCheckbox.checked);
            mockBtn.style.display = debugCheckbox.checked ? 'block' : 'none';
        });

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

                showCalendarMenu(courseName, exerciseName, deadline, time, calendarBtn);
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
        if (document.getElementById('floating-controls-container')) return;
        
        const container = document.createElement('div');
        container.id = 'floating-controls-container';
        container.className = 'hm-float-controls';

        // Management button
        const manageButton = document.createElement('button');
        manageButton.type = 'button';
        manageButton.id = 'manage-pairs-button';
        manageButton.innerText = 'ניהול תצוגת מטלות (טוען...)';
        manageButton.className = 'hm-float-btn hm-float-btn--loading';
        manageButton.disabled = true;
        manageButton.addEventListener('click', () => {});
        container.appendChild(manageButton);

        // Jump Timeline button
        const jumpButton = document.createElement('button');
        jumpButton.type = 'button';
        jumpButton.id = 'jump-to-timeline-button';
        jumpButton.innerText = 'קפיצה למטלות';
        jumpButton.className = 'hm-float-btn hm-float-btn--jump';
        jumpButton.addEventListener('click', jumpToTimelineSection);
        container.appendChild(jumpButton);

        document.body.appendChild(container);
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

    function showCountdown() {
        const headerNodes = document.querySelectorAll('[data-timestamp].mt-3');
        headerNodes.forEach(el => {
            try {
                const diff = parseInt(el.dataset.timestamp) - Math.floor(Date.now() / 1000);
                const days = Math.floor(diff / (60 * 60 * 24));
                el.dataset.mtCountdown = 'ימים: ' + (days < 0 ? 0 : days);
            } catch (error) {
                console.error(error);
            }
        });
    }

    globalThis.HideMatalotManagementDialog = {
        addManagementButton,
        activateManagementButton,
        jumpToTimelineSection,
        showCountdown
    };
})();
