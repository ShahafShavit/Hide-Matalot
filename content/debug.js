(function () {
    'use strict';

    let debugEnabled = false;

    function debugLog(...args) {
        if (!debugEnabled) {
            return;
        }
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim() || 'Unknown line';
        let callerLine = caller.split('/');
        callerLine = callerLine[callerLine.length - 1].replace(')', '');
        console.log(`[Debug] (${callerLine}):`, ...args);
    }

    globalThis.HideMatalotContentDebug = {
        getEnabled: () => debugEnabled,
        setEnabled: (value) => {
            debugEnabled = !!value;
        },
        log: debugLog
    };
})();
