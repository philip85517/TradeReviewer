DEPLOY_ROOT ?= /Users/zhoulin/projects/TradeReview

.PHONY: deploy deploy-code deploy-status deploy-backup deploy-restore deploy-rollback deploy-down deploy-config

deploy:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=deploy --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-code:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=code --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-status:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=status --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-backup:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=backup --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-restore:
	@case "$(BACKUP)" in /*) [ -f "$(BACKUP)" ] && [ ! -L "$(BACKUP)" ] ;; *) false ;; esac || { echo "BACKUP must be an absolute regular, non-symlink backup file" >&2; exit 2; }
	node "$(CURDIR)/scripts/deploy.mjs" --mode=restore --source="$(CURDIR)" --target="$(DEPLOY_ROOT)" --backup="$(BACKUP)"

deploy-rollback:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=rollback --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-down:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=down --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"

deploy-config:
	node "$(CURDIR)/scripts/deploy.mjs" --mode=config --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"
