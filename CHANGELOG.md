# Changelog

## [1.2] - 11.12.2024
### Added
- Verbose logging in debug mode
### Fixed
- Resolved multiple, redundant calls to retrieve state from IndexedDB.
- Improved integrity verification during the extraction of course-exercise pairs.
- Improved startup function with smoother sequence of operations to initialize the extension.

## [1.1.1] - 10.12.2024
### Added
- Added debug mode toggle in the management dialog.
- Integrated IndexedDB instead of localStorage due to security measurements by Moodle.


## [1.1] - 10.12.2024
### Added
- Added toggle toggle feature to dialog launch


## [1.0] - 09.12.2024
### Added
- Initial release of the course assignment visibility manager.
- Features include hiding/showing assignments, saving preferences to localStorage, and dynamic cleanup of unused state.

