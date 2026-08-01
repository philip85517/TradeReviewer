DEPLOY_ROOT ?= $(CURDIR)
DEPLOY_SOURCE ?= $(CURDIR)/app/current
DEPLOY_CLI := $(CURDIR)/ops/deploy.sh

.PHONY: deploy deploy-code deploy-status deploy-backup deploy-restore deploy-rollback deploy-down deploy-config

deploy:
	bash "$(DEPLOY_CLI)" --mode=deploy --source="$(DEPLOY_SOURCE)" --target="$(DEPLOY_ROOT)"

deploy-code:
	bash "$(DEPLOY_CLI)" --mode=code --source="$(DEPLOY_SOURCE)" --target="$(DEPLOY_ROOT)"

deploy-status:
	bash "$(DEPLOY_CLI)" --mode=status --target="$(DEPLOY_ROOT)"

deploy-backup:
	bash "$(DEPLOY_CLI)" --mode=backup --target="$(DEPLOY_ROOT)"

deploy-restore:
	@case "$(BACKUP)" in /*) [ -f "$(BACKUP)" ] && [ ! -L "$(BACKUP)" ] ;; *) false ;; esac || { echo "BACKUP must be an absolute regular, non-symlink backup file" >&2; exit 2; }
	bash "$(DEPLOY_CLI)" --mode=restore --target="$(DEPLOY_ROOT)" --backup="$(BACKUP)"

deploy-rollback:
	bash "$(DEPLOY_CLI)" --mode=rollback --target="$(DEPLOY_ROOT)"

deploy-down:
	bash "$(DEPLOY_CLI)" --mode=down --target="$(DEPLOY_ROOT)"

deploy-config:
	bash "$(DEPLOY_CLI)" --mode=config --source="$(DEPLOY_SOURCE)" --target="$(DEPLOY_ROOT)"
