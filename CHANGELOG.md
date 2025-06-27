# Changelog

All notable changes to this project will be documented in this file.

## [5.7.2]

- Expose the Crystallize Env in the web server default response

## [5.7.1]

- simplify building

## [5.7.0]

- expose the CLI enroll command
- add the enroll command

## [5.6.0]

- bumping libs

## [5.5.0]

- bump Bun version to 1.2.4
- call the bashcompinit if complete does not exist in the shell for autocompletion

## [5.4.6]

- really fixing typo introduced in 5.4.4

## [5.4.5]

- fix typo introduced in 5.4.4

## [5.4.4]

- adding the product configurator boilerplate
- a bit more messages on the install trace

## [5.4.3]

- fix the completion file
- add documentation
- add doc command

## [5.4.2]

- add the Furnitut boilerplate

## [5.4.1]

- Fix duplicates in the content model dump

## [5.4.0]

- add a command to upload assets
- add a command to execute mutations with dependencies

## [5.3.0]

- fix tenantId that was not setup on the .env file after installation
- add discovery api tenant ignition

## [5.2.2]

- fix bug introduced in the 5.2.1 for tenant create command

## [5.2.1]

- capability to replace Root Tenant Id and Vat Type in the install process from the extra mutation.

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
