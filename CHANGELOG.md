# Changelog

## [1.4] - 2026-04-14
### Added
- The extension is now fully supported across all academic Moodle platforms in Israel (.ac.il domains).
- Added a new button to export deadlines to Microsoft Calendar, alongside the existing Google Calendar option.
- Introduced a new "Jump" button to instantly navigate directly to the assignments section on the course page.

## [1.3] - 13.04.2026
### Added
- Full assignment notification feature with per-assignment settings (Time and date selection; Runs when in background, no need for Moodle page to be open).
- Google Calendar add button for each assignment.

### Changed
- Management button now appears early in loading state and activates after data load.

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

