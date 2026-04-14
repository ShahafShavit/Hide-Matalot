(function () {
    'use strict';

    const storage = () => globalThis.HideMatalotIndexedDb;
    const parser = () => globalThis.HideMatalotAssignmentsParser;
    const client = () => globalThis.HideMatalotRuntimeClient;
    const management = () => globalThis.HideMatalotManagementDialog;
    const debug = () => globalThis.HideMatalotContentDebug;

    async function cleanUpState(pairs) {
        const savedState = await storage().getSavedState();
        const activeKeys = new Set(pairs.map((pair) => pair.uniqueKey));
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

    async function init() {
        try {
            management().addManagementButton();

            const timeoutSeconds = await storage().getSetting('initWaitTime');
            const debugFromDb = await storage().getSetting('debug');
            debug().setEnabled(!!debugFromDb);
            if (debug().getEnabled()) debug().log('Debug mode is enabled. You can disable it in the dialoge.');
            debug().log('Fetching Init saved state...');
            let currentState = await storage().getSavedState();

            debug().log(`Waiting for ${timeoutSeconds} seconds before starting...`);
            await new Promise((resolve) => setTimeout(resolve, timeoutSeconds * 1000));

            debug().log("Waiting for 'View More Events' buttons to complete...");
            await clickViewMoreButton();
            await new Promise((resolve) => setTimeout(resolve, 1500));

            debug().log('Extracting course-exercise pairs...');
            let pairs = parser().extractCourseExercisePairs(currentState);

            debug().log(`Fetched total of ${pairs.length} assingnments.`);
            debug().log('Verifying integrity of pulling of assignments...');
            await new Promise((resolve) => setTimeout(resolve, 800));
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
                button.style.backgroundColor = '#d9534f';
                button.style.cursor = 'not-allowed';
                button.disabled = true;
            }
        }
    }

    globalThis.HideMatalotInitController = { init };
})();
