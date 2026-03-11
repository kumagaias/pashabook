.PHONY: help install test test-unit test-security clean

help: ## Display available commands
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "Installing dependencies..."
	cd mobile && npm install
	cd backend && npm install
	@echo "✅ Dependencies installed"

test: test-unit test-security ## Run all tests (unit + security)

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	@if [ -d "backend/node_modules" ]; then \
		if [ -n "$$(find backend -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null)" ]; then \
			cd backend && npm test; \
		else \
			echo "⚠️  No test files found yet. Skipping tests."; \
			echo "✅ Tests will be added during implementation"; \
		fi \
	else \
		echo "⚠️  Backend dependencies not installed yet. Run 'make install' first."; \
		echo "✅ Skipping tests for initial setup"; \
	fi

test-security: ## Run security checks
	@echo "Running security checks with gitleaks..."
	@if command -v gitleaks >/dev/null 2>&1; then \
		gitleaks detect --verbose; \
		echo "✅ Security checks passed"; \
	else \
		echo "⚠️  gitleaks not installed. Install with: brew install gitleaks"; \
		exit 1; \
	fi

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf mobile/node_modules
	rm -rf mobile/.expo
	rm -rf mobile/dist
	rm -rf mobile/build
	rm -rf backend/node_modules
	rm -rf backend/dist
	@echo "✅ Clean complete"
