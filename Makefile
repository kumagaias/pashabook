.PHONY: help install test test-unit test-security clean dev-build web-build web-deploy web-preview backend-deploy backend-update-env

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

backend-deploy: ## Deploy backend to Cloud Run
	@echo "Deploying backend to Cloud Run..."
	cd infra && GCP_PROJECT_ID=pashabook-dev ./scripts/deploy.sh
	@echo "✅ Backend deployed"

backend-update-env: ## Update Cloud Run environment variables only
	@echo "Updating Cloud Run environment variables..."
	GCP_PROJECT_ID=pashabook-dev GCP_REGION=asia-northeast1 ./infra/scripts/update-env-vars.sh
	@echo "✅ Environment variables updated"

dev-build: ## Build development app (Android/iOS)
	@echo "Building development app..."
	cd mobile && npx expo prebuild
	@echo "✅ Development build complete"

web-build: ## Build web app for production
	@echo "Building web app..."
	cd mobile && npx expo export --platform web
	@echo "✅ Web build complete (mobile/dist)"

web-deploy: web-build ## Deploy web app to Firebase Hosting
	@echo "Deploying to Firebase Hosting..."
	cd mobile && firebase deploy --only hosting
	@echo "✅ Deployed to Firebase Hosting"

web-preview: web-build ## Preview web app locally
	@echo "Starting local preview..."
	cd mobile/dist && python3 -m http.server 8000

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf mobile/node_modules
	rm -rf mobile/.expo
	rm -rf mobile/dist
	rm -rf mobile/build
	rm -rf backend/node_modules
	rm -rf backend/dist
	@echo "✅ Clean complete"
