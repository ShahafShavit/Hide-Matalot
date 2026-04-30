(function (global) {
    function saveFile(url, filename) {
        chrome.downloads.download({
            url,
            filename,
            saveAs: true
        });
    }
    global.HideMatalotFileExports = {
        saveFile
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);