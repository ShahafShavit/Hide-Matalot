(function () {
    'use strict';

    // Check if this is a Moodle site
    if (!window.location.hostname.includes('moodle.')) {
        return;
    }

    globalThis.HideMatalotInitController.init();
})();
