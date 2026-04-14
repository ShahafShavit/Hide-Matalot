(function () {
    'use strict';

    const storage = () => globalThis.HideMatalotIndexedDb;
    const parser = () => globalThis.HideMatalotAssignmentsParser;
    const client = () => globalThis.HideMatalotRuntimeClient;
    const management = () => globalThis.HideMatalotManagementDialog;
    const debug = () => globalThis.HideMatalotContentDebug;

    function collectActiveAssignmentKeys(pairs) {
        const activeKeys = new Set();
        for (const pair of pairs) {
            activeKeys.add(pair.uniqueKey);
            if (pair.legacyKey && pair.legacyKey !== pair.uniqueKey) {
                activeKeys.add(pair.legacyKey);
            }
        }
        return activeKeys;
    }

    async function cleanUpState(pairs) {
        const savedState = await storage().getSavedState();
        const activeKeys = collectActiveAssignmentKeys(pairs);
        const updatedState = Object.fromEntries(Object.entries(savedState).filter(([key]) => activeKeys.has(key)));
        storage().saveState(updatedState);
        await client().cleanUpNotifications(pairs);
        return updatedState;
    }

    async function clickViewMoreButton() {
        const targetText = 'הצגת פעילויות נוספות';
        let found = false;

        while (true) {
            const buttons = document.querySelectorAll('.btn.btn-secondary');
            for (const button of buttons) {
                if (button.innerText.trim() === targetText) {
                    debug().log(`Found button with text "${targetText}". Clicking...`);
                    button.click();
                    found = true;
                    break;
                }
            }

            if (!found) {
                debug().log("No 'View More Events' button found.");
                break;
            }
            break;
        }
    }

    const ASSIGNMENT_ITEM_SELECTOR = '.list-group-item.timeline-event-list-item';

    function waitForAssignmentListStable(options) {
        const timeoutMs = Math.max(0, options.timeoutMs || 0);
        const stableDurationMs = Math.max(50, options.stableDurationMs || 400);
        return new Promise((resolve) => {
            const started = Date.now();
            let lastCount = document.querySelectorAll(ASSIGNMENT_ITEM_SELECTOR).length;
            let stableTimer = null;

            const teardown = () => {
                observer.disconnect();
                if (stableTimer) clearTimeout(stableTimer);
            };

            const finish = () => {
                teardown();
                resolve();
            };

            const armStableTimer = () => {
                if (stableTimer) clearTimeout(stableTimer);
                stableTimer = setTimeout(() => {
                    const current = document.querySelectorAll(ASSIGNMENT_ITEM_SELECTOR).length;
                    const elapsed = Date.now() - started;
                    if (current !== lastCount) {
                        lastCount = current;
                        armStableTimer();
                        return;
                    }
                    if (elapsed >= timeoutMs || current > 0) {
                        finish();
                    } else {
                        armStableTimer();
                    }
                }, stableDurationMs);
            };

            const onMutation = () => {
                if (Date.now() - started >= timeoutMs) {
                    finish();
                    return;
                }
                const current = document.querySelectorAll(ASSIGNMENT_ITEM_SELECTOR).length;
                if (current !== lastCount) {
                    lastCount = current;
                    if (stableTimer) clearTimeout(stableTimer);
                    armStableTimer();
                }
            };

            const observer = new MutationObserver(onMutation);
            observer.observe(document.documentElement, { childList: true, subtree: true });

            if (Date.now() - started >= timeoutMs) {
                finish();
                return;
            }
            armStableTimer();
        });
    }

    function doubleRequestAnimationFrame() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    async function init() {
        try {
            management().addManagementButton();

            const timeoutSeconds = await storage().getSetting('initWaitTime');
            const waitCapMs = Math.max(1000, (Number(timeoutSeconds) || 4) * 1000);
            const debugFromDb = await storage().getSetting('debug');
            debug().setEnabled(!!debugFromDb);
            if (debug().getEnabled()) debug().log('Debug mode is enabled. You can disable it in the dialoge.');
            debug().log('Fetching Init saved state...');
            let currentState = await storage().getSavedState();

            debug().log(`Waiting for assignment list to settle (cap ${waitCapMs} ms)...`);
            await waitForAssignmentListStable({ timeoutMs: waitCapMs, stableDurationMs: 450 });

            debug().log("Waiting for 'View More Events' buttons to complete...");
            await clickViewMoreButton();
            debug().log('Waiting for list to settle after expand...');
            await waitForAssignmentListStable({ timeoutMs: 12000, stableDurationMs: 500 });

            debug().log('Extracting course-exercise pairs...');
            let pairs = parser().extractCourseExercisePairs(currentState);

            debug().log(`Fetched total of ${pairs.length} assingnments.`);
            debug().log('Verifying integrity of pulling of assignments...');
            await doubleRequestAnimationFrame();
            const pairsCheck = parser().extractCourseExercisePairs(currentState);
            if (pairs.length < pairsCheck.length) {
                debug().log('Integrity check failed, using lastest pull.');
                pairs = pairsCheck;
            } else {
                debug().log('Integrity verification passed...');
            }

            debug().log('Cleaning up state...');
            cleanUpState(pairs);

            debug().log('Cleaning up /dates/...');
            parser().cleanUpDates();

            debug().log('Activating management button...');
            management().activateManagementButton(pairs);
        } catch (error) {
            console.error('Initialization error:', error);
            const button = document.getElementById('manage-pairs-button');
            if (button) {
                button.innerText = 'ניהול תצוגת מטלות (שגיאה בטעינה)';
                button.classList.remove('hm-float-btn--loading', 'hm-float-btn--ready');
                button.classList.add('hm-float-btn--error');
                button.disabled = true;
            }
        }
    }

    globalThis.HideMatalotInitController = { init };
})();
