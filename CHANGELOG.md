# Changelog

All notable changes to this project will be documented in this file.

## [5.2.0]

### Added

- new boilerplates
- dump content model as Mass Operations
- create invite(s) command.
- get Shop Auth token command.
- get Static Auth token command.
- get Pim Auth token command.

### Fixed

- added missing `tenant` in the completion command list.

## [5.1.0]

### Added

- `CHANGELOG.md` file is not present and can be used.
- add the `changelog` command.
- script completion file is installed on program run, and the install bash is reloading the SHELL.
- create tenant command

### Changed

- revamped the command organization. (BC)

## [5.0.1]

### Added

- (internal) Make it work on the Crystallize Staging environement

## [5.0.0]

This is the new version that will live in the future, built on top of Bun.js it is shipped through Github and does not require anything on the user side.

### Added

- `login` command to save your credentials `~/.crystallize/credentials.json`.
- `whoami` tells you who is logged-in via `~/.crystallize/credentials.json`.
- (wip) `install-boilerplate` to install boilerplates.
- `run-mass-operation` to run Mass Operation files.

## [4.x]

The 4.x version called `@crystallize/cli-next`, hosted in NPMJS is now deprecated, it was mainly used to install boilerplates, dump and import
tenant data. It was using `@crystallize/import-utilities` which is now deprecated in favor of Mass Operation

## [3.x]

The 3.x version called `@crystallize/cli`, hosted in NPMJS is now deprecated, it was mainly used to install old-legacy boilerplates
