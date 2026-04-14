(function () {
    'use strict';

    function computeStableAssignmentKey(assignmentLink, courseName, exerciseName) {
        const legacyKey = `${courseName}::${exerciseName}`;
        if (!assignmentLink || !String(assignmentLink).trim()) {
            return legacyKey;
        }
        try {
            const u = new URL(assignmentLink);
            u.hash = '';
            const id = u.searchParams.get('id');
            if (id && /^\d+$/.test(id) && u.pathname.includes('/mod/')) {
                return `cm:${id}`;
            }
            const normalized = `${u.origin}${u.pathname}${u.search}`;
            return `url:${normalized}`;
        } catch {
            return legacyKey;
        }
    }

    function resolveVisibilityFromState(savedState, uniqueKey, legacyKey) {
        if (Object.prototype.hasOwnProperty.call(savedState, uniqueKey)) {
            return savedState[uniqueKey];
        }
        if (legacyKey !== uniqueKey && Object.prototype.hasOwnProperty.call(savedState, legacyKey)) {
            return savedState[legacyKey];
        }
        return undefined;
    }

    function cleanUpDates() {
        const dateElements = document.querySelectorAll('[data-region="event-list-content-date"]');
        dateElements.forEach((dateElement) => {
            const siblingItems = dateElement.nextElementSibling.querySelectorAll(
                '.list-group-item.timeline-event-list-item'
            );

            const hasVisibleItems = Array.from(siblingItems).some((item) => item.style.display !== 'none');

            if (!hasVisibleItems) {
                dateElement.style.display = 'none';
            } else {
                dateElement.style.display = '';
            }
        });
    }

    function extractCourseExercisePairs(savedState) {
        const items = document.querySelectorAll('.list-group-item.timeline-event-list-item');
        const pairs = [];

        items.forEach((item) => {
            const courseNameElement = item.querySelector('.event-name-container small');
            const exerciseNameElement = item.querySelector('.event-name-container a');
            const timeElement = item.querySelector('.text-end.text-nowrap.align-self-center.ms-1');

            if (courseNameElement && exerciseNameElement) {
                const courseName = courseNameElement.innerText.trim().replace("יש להגיש את 'מטלה' · ", '');
                const exerciseName = exerciseNameElement.innerText.trim();
                const legacyKey = `${courseName}::${exerciseName}`;
                const assignmentLink = exerciseNameElement.href || '';
                const uniqueKey = computeStableAssignmentKey(assignmentLink, courseName, exerciseName);

                const time = timeElement ? timeElement.innerText.trim() : '23:55';

                let deadline = null;
                const wrapper = item.closest('.pb-2') || item.closest('[data-region="event-list-wrapper"]');
                if (wrapper) {
                    const allDateHeaders = wrapper.querySelectorAll('[data-region="event-list-content-date"]');
                    for (let i = 0; i < allDateHeaders.length; i++) {
                        const currentList = allDateHeaders[i].nextElementSibling;
                        if (currentList?.contains(item)) {
                            deadline = parseInt(allDateHeaders[i].getAttribute('data-timestamp'), 10);
                            break;
                        }
                    }
                }

                if (resolveVisibilityFromState(savedState, uniqueKey, legacyKey) === false) {
                    item.style.display = 'none';
                } else {
                    item.style.display = '';
                }

                pairs.push({
                    courseName,
                    exerciseName,
                    item,
                    uniqueKey,
                    legacyKey,
                    deadline,
                    time,
                    assignmentLink
                });
            }
        });

        return pairs;
    }

    globalThis.HideMatalotAssignmentsParser = {
        cleanUpDates,
        extractCourseExercisePairs,
        computeStableAssignmentKey,
        resolveVisibilityFromState
    };
})();
