# Changelog

All notable changes to this project will be documented in this file.

## [5.14.0]

- bump the schema lib to 6.7.0

## [5.13.0]

- bump the schema lib to 6.6.0

## [5.12.0]

- bump the schema lib to 6.5.0
- adding a new check on start to check if the CLI running version is the last one

## [5.11.4]

- bump the schema lib to 6.3.4

## [5.11.4]

- bump the libs for pricelists fix

## [5.11.3]

- really bump the libs for topics

## [5.11.2]

- really bump the libs.

## [5.11.1]

- really bump the libs.

## [5.11.0]

- bump libs and schema lib to 6.0.0.

## [5.10.1]

- bump libs and schema lib to 5.3.

## [5.10.0]

- add an option to dump the model without any item id references.

## [5.9.3]

- bump libs and schema lib to 5.2.

## [5.9.2]

- bump libs and schema lib to 5.1.

## [5.9.1]

- added more errors on the serve command when authentication is failing.

## [5.9.0]

- piece name are now maintained in the content model dump.

## [5.8.2]

- move a log to a debug log.

## [5.8.1]

- allow relative path in bynary uploads.

## [5.8.0]

- update libs.
- use new js-api-client.
- handle file uploads in extra mutations.

## [5.7.6]

- adds codes to messages that are streamed to FE while tenant is being updated with selected template.

## [5.7.5]

- schema 4.0.0
- compatible with Mass Operations for Customers.

## [5.7.4]

- replace all iteration of the placeholders in the install process.

## [5.7.3]

- Enable CORS.

## [5.7.2]

- Expose the Crystallize Env in the web server default response.

## [5.7.1]

- simplify building.

## [5.7.0]

- expose the CLI enroll command.
- add the enroll command.

## [5.6.0]

- bumping libs.

## [5.5.0]

- bump Bun version to 1.2.4.
- call the bashcompinit if complete does not exist in the shell for autocompletion.

## [5.4.6]

- really fixing typo introduced in 5.4.4.

## [5.4.5]

- fix typo introduced in 5.4.4.

## [5.4.4]

- adding the product configurator boilerplate.
- a bit more messages on the install trace.

## [5.4.3]

- fix the completion file.
- add documentation.
- add doc command.

## [5.4.2]

- add the Furnitut boilerplate.

## [5.4.1]

- Fix duplicates in the content model dump.

## [5.4.0]

- add a command to upload assets.
- add a command to execute mutations with dependencies.

## [5.3.0]

- fix tenantId that was not setup on the .env file after installation.
- add discovery api tenant ignition.

## [5.2.2]

- fix bug introduced in the 5.2.1 for tenant create command.

## [5.2.1]

- capability to replace Root Tenant Id and Vat Type in the install process from the extra mutation.

## [5.2.0]

### Added

- new boilerplates
- dump content model as Mass Operations.
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
- create tenant command.

### Changed

- revamped the command organization. (BC).

## [5.0.1]

### Added

- (internal) Make it work on the Crystallize Staging environement.

## [5.0.0]

This is the new version that will live in the future, built on top of Bun.js it is shipped through Github and does not require anything on the user side.

### Added

- `login` command to save your credentials `~/.crystallize/credentials.json`.
- `whoami` tells you who is logged-in via `~/.crystallize/credentials.json`.
- (wip) `install-boilerplate` to install boilerplates.
- `run-mass-operation` to run Mass Operation files.

## [4.x]

The 4.x version called `@crystallize/cli-next`, hosted in NPMJS is now deprecated, it was mainly used to install boilerplates, dump and import.
tenant data. It was using `@crystallize/import-utilities` which is now deprecated in favor of Mass Operation.

## [3.x]

The 3.x version called `@crystallize/cli`, hosted in NPMJS is now deprecated, it was mainly used to install old-legacy boilerplates.
