(function () {
    'use strict';

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
                const uniqueKey = `${courseName}::${exerciseName}`;
                const assignmentLink = exerciseNameElement.href || '';

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

    globalThis.HideMatalotAssignmentsParser = {
        cleanUpDates,
        extractCourseExercisePairs
    };
})();
