DEPLOY_ROOT ?= /Users/zhoulin/projects/交易空间/TradingReview
DEPLOY_SOURCE ?= $(CURDIR)
REF ?= current
DRY_RUN ?= 0
NATIVE_CLI := $(CURDIR)/scripts/deploy-native.mjs
NATIVE_NODE := $(CURDIR)/scripts/native-node.sh
DOCKER_CLI := $(CURDIR)/scripts/deploy.mjs
export DEPLOY_ROOT DEPLOY_SOURCE REF DRY_RUN NATIVE_CLI NATIVE_NODE DOCKER_CLI BACKUP

.PHONY: dev debug-test deploy deploy-code deploy-status deploy-rollback deploy-down deploy-test deploy-docker deploy-docker-code deploy-docker-status deploy-docker-backup deploy-docker-restore deploy-docker-rollback deploy-docker-down deploy-docker-config deploy-backup deploy-restore deploy-config

dev:
	npm run dev

debug-test:
	"$$NATIVE_NODE" --test scripts/native-environment.test.mjs scripts/debug-local.test.mjs

deploy deploy-code:
	"$$NATIVE_NODE" "$$NATIVE_CLI" --mode=deploy --source="$$DEPLOY_SOURCE" --target="$$DEPLOY_ROOT" --ref="$$REF" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-status:
	"$$NATIVE_NODE" "$$NATIVE_CLI" --mode=status --target="$$DEPLOY_ROOT"

deploy-rollback:
	"$$NATIVE_NODE" "$$NATIVE_CLI" --mode=rollback --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-down:
	"$$NATIVE_NODE" "$$NATIVE_CLI" --mode=down --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-test:
	"$$NATIVE_NODE" --test scripts/native-environment.test.mjs scripts/deploy-source.test.mjs scripts/deploy-native-runtime.test.mjs scripts/deploy-native-toolkit.test.mjs scripts/deploy-native.test.mjs scripts/deploy-native-safety.test.mjs

deploy-docker:
	node "$$DOCKER_CLI" --mode=deploy --source="$$DEPLOY_SOURCE" --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-docker-code:
	node "$$DOCKER_CLI" --mode=code --source="$$DEPLOY_SOURCE" --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-docker-status:
	node "$$DOCKER_CLI" --mode=status --target="$$DEPLOY_ROOT"

deploy-docker-backup:
	node "$$DOCKER_CLI" --mode=backup --target="$$DEPLOY_ROOT"

deploy-docker-restore:
	@case "$$BACKUP" in /*) [ -f "$$BACKUP" ] && [ ! -L "$$BACKUP" ] ;; *) false ;; esac || { echo "BACKUP must be an absolute regular, non-symlink backup file" >&2; exit 2; }
	node "$$DOCKER_CLI" --mode=restore --target="$$DEPLOY_ROOT" --backup="$$BACKUP"

deploy-docker-rollback:
	node "$$DOCKER_CLI" --mode=rollback --target="$$DEPLOY_ROOT"

deploy-docker-down:
	node "$$DOCKER_CLI" --mode=down --target="$$DEPLOY_ROOT"

deploy-docker-config:
	node "$$DOCKER_CLI" --mode=config --source="$$DEPLOY_SOURCE" --target="$$DEPLOY_ROOT"

deploy-backup deploy-restore deploy-config:
	@echo "Native database operations are documented in DEPLOYMENT.md; Docker operations require explicit deploy-docker-* targets." >&2; exit 2
