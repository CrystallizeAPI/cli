# === Makefile Helper ===

# Styles
YELLOW=$(shell echo "\033[00;33m")
RED=$(shell echo "\033[00;31m")
RESTORE=$(shell echo "\033[0m")

.DEFAULT_GOAL := list

.PHONY: list
list:
	@echo "******************************"
	@echo "${YELLOW}Available targets${RESTORE}:"
	@grep -E '^[a-zA-Z-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf " ${YELLOW}%-15s${RESTORE} > %s\n", $$1, $$2}'
	@echo "${RED}==============================${RESTORE}"

.PHONY: codeclean
codeclean: ## Code Clean
	@bun prettier --write .

.PHONY: build
build: ## Build
	@bun build --bundle src/index.ts --outfile crystallize.js --target=bun
	@bun shim.ts
	@bun build --compile --minify crystallize.js --outfile crystallize
	@rm crystallize.js
	@rm -f ./.*.bun-build


.PHONY: build-all
build-all:
	@bun build --bundle src/index.ts --outfile crystallize.js --target=bun
	@bun shim.ts
	for target in bun-linux-x64 bun-linux-arm64 bun-windows-x64 bun-darwin-x64 bun-darwin-arm64; do \
		bun build --compile --minify crystallize.js --outfile crystallize-$$target --target=$$target; \
	done
	@rm crystallize.js
	@rm -f ./.*.bun-build
