(function () {
    'use strict';

    const debug = () => globalThis.HideMatalotContentDebug;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ExerciseVisibilityDB', 2);
            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains('states')) {
                    db.createObjectStore('states', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    const settingStore = db.createObjectStore('settings', { autoIncrement: false });
                    settingStore.put(false, 'debug');
                    settingStore.put(4, 'initWaitTime');
                }
                if (!db.objectStoreNames.contains('notifications')) {
                    db.createObjectStore('notifications', { keyPath: 'id' });
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
        return openDatabase().then((db) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('states', 'readwrite');
                const store = transaction.objectStore('states');
                store.put({ id: 'visibilityState', data });
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        });
    }

    function getFromIndexedDB() {
        return openDatabase().then((db) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('states', 'readonly');
                const store = transaction.objectStore('states');
                const request = store.get('visibilityState');
                request.onsuccess = function () {
                    resolve(request.result ? request.result.data : {});
                };
                request.onerror = reject;
            });
        });
    }

    async function saveState(state) {
        debug().log('Saving state to IndexedDB:', state);
        try {
            await saveToIndexedDB(state);
            debug().log('State saved successfully to IndexedDB.');
        } catch (error) {
            console.error('Error saving to IndexedDB:', error);
        }
    }

    function getSavedState() {
        return getFromIndexedDB().then((saved) => {
            debug().log('Retrieved state from IndexedDB:', saved);
            return saved || {};
        });
    }

    async function getSetting(key) {
        debug().log(`Getting setting ${key} from DB`);
        try {
            const db = await openDatabase();
            const transaction = db.transaction('settings', 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            return await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    debug().log(`Successfuly pulled ${key}: ${request.result} from DB`);
                    resolve(request.result !== undefined ? request.result : null);
                };
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`Error retrieving setting "${key}" from IndexedDB:`, error);
            return null;
        }
    }

    async function saveSetting(key, value) {
        function saveSettingToIndexedDB(k, v) {
            return openDatabase().then((db) => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction('settings', 'readwrite');
                    const store = transaction.objectStore('settings');
                    const request = store.put(v, k);
                    request.onsuccess = function () {
                        resolve(`Successfully saved key "${k}" with value.`);
                    };
                    request.onerror = function () {
                        reject(`Failed to save key "${k}": ${request.error}`);
                    };
                });
            });
        }
        debug().log(`Saving setting: "${key}":${value} to IndexedDB.`);
        try {
            await saveSettingToIndexedDB(key, value);
            debug().log('Setting saved successfully to IndexedDB.');
        } catch (error) {
            console.error('Error saving to IndexedDB:', error);
        }
    }

    globalThis.HideMatalotIndexedDb = {
        openDatabase,
        saveState,
        getSavedState,
        getSetting,
        saveSetting
    };
})();
