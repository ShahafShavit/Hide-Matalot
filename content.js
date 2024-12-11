(function () {
    'use strict';

    let debugEnabled = false;
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("ExerciseVisibilityDB", 1);
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
        return updatedState;
    }

    async function extractCourseExercisePairs() {
        const items = document.querySelectorAll(".list-group-item.timeline-event-list-item");
        const pairs = [];
        const savedState = await getSavedState(); 

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

    
    function debugLog(...args) {
        if (debugEnabled) {
            const stack = new Error().stack;
            const caller = stack.split("\n")[2]?.trim() || "Unknown line";
            let callerLine = caller.split("/");
            callerLine = callerLine[callerLine.length - 1].replace(")","");
            // Include the caller's location in the log
            console.log(`[Debug] (${callerLine}):`, ...args);
        }
    }

    async function displayDialoge(pairs) {
        if (document.getElementById('table-management')) return;

        const savedState = await getSavedState();

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
            <th style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">הסתר</th>
        `;
        table.appendChild(headerRow);

        pairs.forEach(({ courseName, exerciseName, item, uniqueKey }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: ${padding}px;">${courseName}</td>
                <td style="border: 1px solid #ccc; padding: ${padding}px;">${exerciseName}</td>
                <td style="border: 1px solid #ccc; padding: ${padding}px; text-align: center;">
                    <input type="checkbox" ${savedState[uniqueKey] === false ? 'checked' : ''}>
                </td>
            `;
            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', async () => {
                const isChecked = checkbox.checked;
                if (isChecked) {
                    item.style.display = 'none';
                    savedState[uniqueKey] = false;
                } else {
                    item.style.display = '';
                    delete savedState[uniqueKey];
                }
                await saveState(savedState);
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
        button.innerText = 'ניהול תצוגת מטלות';
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
            const container = document.getElementById("table-management");
            if (container) {
                document.body.removeChild(container)
            }
            else {
                displayDialoge(pairs);
            }
        });
        document.body.appendChild(button);
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
            const timeoutSeconds = await getSetting("initWaitTime");
            debugEnabled = await getSetting("debug");
            
            if (debugEnabled) debugLog("Debug mode is enabled. You can disable it in the dialoge.");
            
            debugLog(`Waiting for ${timeoutSeconds} seconds before starting...`);
            await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000)); // Initial delay

            await clickViewMoreButton();
            debugLog("Waiting for 'View More Events' buttons to complete...");
            await new Promise(resolve => setTimeout(resolve, 1500));

            debugLog("Extracting course-exercise pairs...");
            const pairs = await extractCourseExercisePairs();
            debugLog(`Fetched total of ${pairs.length} assingnments.`);

            debugLog("Fetching saved state...");
            const savedState = await getSavedState();

            debugLog("Cleaning up state...");
            cleanUpState(pairs, savedState);

            debugLog("Cleaning up /dates/...");
            cleanUpDates();

            debugLog("Adding management button...");
            addManagementButton(pairs);
        } catch (error) {
            console.error("Initialization error:", error);
        }
    }

    init();
})();
