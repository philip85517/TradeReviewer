DEPLOY_ROOT ?= $(CURDIR)
# A release is an immutable archive, not a Git checkout. Supply a source repository to publish.
DEPLOY_SOURCE ?= $(CURDIR)/app/current
REF ?= current
DRY_RUN ?= 0
# A native config or control file marks a native target, even if other tools are missing.
# Missing native tools must fail rather than silently switching to Docker.
empty :=
space := $(empty) $(empty)
NATIVE_PROBE := $(subst $(space),\$(space),$(CURDIR)/config/runtime.json) $(subst $(space),\$(space),$(CURDIR)/ops/deploy-native.mjs) $(subst $(space),\$(space),$(CURDIR)/ops/start-native.command)
DEPLOY_RUNTIME ?= $(if $(wildcard $(NATIVE_PROBE)),native,docker)
NATIVE_CLI := $(CURDIR)/ops/deploy-native.mjs
DOCKER_CLI := $(CURDIR)/ops/deploy.mjs
export DEPLOY_ROOT DEPLOY_SOURCE REF DRY_RUN NATIVE_CLI DOCKER_CLI BACKUP

.PHONY: deploy deploy-code deploy-status deploy-rollback deploy-down deploy-test deploy-docker deploy-docker-code deploy-docker-status deploy-docker-backup deploy-docker-restore deploy-docker-rollback deploy-docker-down deploy-docker-config deploy-backup deploy-restore deploy-config

ifeq ($(DEPLOY_RUNTIME),native)
deploy deploy-code:
	node "$$NATIVE_CLI" --mode=deploy --source="$$DEPLOY_SOURCE" --target="$$DEPLOY_ROOT" --ref="$$REF" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-status:
	node "$$NATIVE_CLI" --mode=status --target="$$DEPLOY_ROOT"

deploy-rollback:
	node "$$NATIVE_CLI" --mode=rollback --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-down:
	node "$$NATIVE_CLI" --mode=down --target="$$DEPLOY_ROOT" $(if $(filter 1,$(DRY_RUN)),--dry-run,)

deploy-backup deploy-restore deploy-config:
	@echo "Native database operations are documented in DEPLOYMENT.md; Docker operations require explicit deploy-docker-* targets." >&2; exit 2
else
deploy: deploy-docker
deploy-code: deploy-docker-code
deploy-status: deploy-docker-status
deploy-rollback: deploy-docker-rollback
deploy-down: deploy-docker-down
deploy-backup: deploy-docker-backup
deploy-restore: deploy-docker-restore
deploy-config: deploy-docker-config
endif

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
