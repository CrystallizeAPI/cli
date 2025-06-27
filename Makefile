# === Makefile Helper ===

# Styles
YELLOW=$(shell echo "\033[00;33m")
RED=$(shell echo "\033[00;31m")
RESTORE=$(shell echo "\033[0m")
BUN=bun

.DEFAULT_GOAL := list

.PHONY: list
list:
	@echo "******************************"
	@echo "${YELLOW}Available targets${RESTORE}:"
	@grep -E '^[a-zA-Z-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf " ${YELLOW}%-15s${RESTORE} > %s\n", $$1, $$2}'
	@echo "${RED}==============================${RESTORE}"

.PHONY: codeclean
codeclean: ## Code Clean
	@$(BUN) prettier --write .

.PHONY: run
run: ## Run ARGS=""
	@LOG_LEVELS=info,debug $(BUN) src/index.ts $$ARGS

.PHONY: staging-run
staging-run: ## Run ARGS=""
	@CRYSTALLIZE_ENVIRONMENT=staging LOG_LEVELS=info,debug $(BUN) src/index.ts $$ARGS

.PHONY: build
build: ## Build CLI
	@$(BUN) build --compile --minify src/index --outfile crystallize
	@rm -f .*.bun-build

.PHONY: build-all
build-all:
	for target in bun-linux-x64 bun-linux-arm64 bun-windows-x64 bun-darwin-x64 bun-darwin-arm64; do \
		$(BUN) build --compile --minify src/index --outfile crystallize-$$target --target=$$target; \
	done
	@rm -f ./.*.bun-build
