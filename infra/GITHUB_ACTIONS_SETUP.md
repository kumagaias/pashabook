# GitHub Actions CI/CD Setup

Workload Identity Federationを使ったトークンレスデプロイの設定手順。

---

## Backend (Cloud Run)

### 1. Terraform設定

#### terraform.tfvarsを更新

```bash
cd infra/environments/dev
```

`terraform.tfvars`の`github_repository`を実際のリポジトリ名に変更:

```hcl
github_repository = "username/pashabook"  # 実際のGitHubリポジトリ名
```

#### Terraformを適用

```bash
terraform init
terraform plan
terraform apply
```

これで以下が作成されます:
- Workload Identity Pool
- Workload Identity Provider (GitHub OIDC)
- GitHub Actions用サービスアカウント
- 必要な権限 (Artifact Registry writer, Cloud Run admin等)

---

### 2. GitHub Secretsを設定

Terraform適用後、以下のコマンドで必要な値を取得:

```bash
cd infra/environments/dev

# Workload Identity Provider
terraform output -raw workload_identity_provider

# Service Account Email
terraform output -raw github_actions_service_account_email
```

GitHubリポジトリのSettings > Secrets and variables > Actionsで以下を追加:

- `WIF_PROVIDER`: Workload Identity Provider (上記コマンドの出力)
- `WIF_SERVICE_ACCOUNT`: Service Account Email (上記コマンドの出力)

---

### 3. ワークフローの動作

`.github/workflows/deploy-backend.yml`が以下のタイミングで実行:
- `main`ブランチへのpush (backend/配下の変更時)
- 手動実行 (Actions > Deploy Backend > Run workflow)

ワークフローの処理:
1. Workload Identity Federationで認証 (トークンレス)
2. Docker imageをbuild
3. Artifact Registryにpush
4. Cloud Runにdeploy

---

## Web (Firebase Hosting)

### 1. Firebase Service Accountを作成

```bash
# Firebase CLIでログイン
firebase login

# Service Account JSONを生成
firebase init hosting:github
```

または手動で作成:

1. [GCP Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. "Create Service Account"をクリック
3. 名前: `github-actions-firebase`
4. 権限を追加:
   - `Firebase Hosting Admin`
   - `Service Account User`
5. "Create Key" > JSON形式でダウンロード

---

### 2. GitHub Secretsを設定

GitHubリポジトリのSettings > Secrets and variables > Actionsで以下を追加:

- `FIREBASE_SERVICE_ACCOUNT`: Service Account JSONの内容全体をコピー&ペースト

---

### 3. ワークフローの動作

`.github/workflows/deploy-web.yml`が以下のタイミングで実行:
- `main`ブランチへのpush (mobile/配下の変更時)
- 手動実行 (Actions > Deploy Web > Run workflow)

ワークフローの処理:
1. Node.js 20をセットアップ
2. 依存関係をインストール
3. Expo webビルド
4. Firebase Hostingにdeploy

---

## 初回デプロイ

```bash
# 変更をcommit
git add .
git commit -m "feat: Update feature"
git push origin main

# GitHub Actionsが自動実行される
# https://github.com/username/pashabook/actions で確認
```

---

## セキュリティ

**Backend:**
- トークン不要 (Workload Identity Federation使用)
- リポジトリ制限 (attribute_conditionで指定リポジトリのみ許可)
- 最小権限 (必要な権限のみ付与)
- Terraform管理 (IaCで監査可能)

**Web:**
- Firebase Service Account使用
- GitHub Secretsで安全に管理
- 最小権限 (Firebase Hosting Adminのみ)

---

## トラブルシューティング

### Backend: "Failed to authenticate" エラー
- GitHub Secretsが正しく設定されているか確認
- `terraform output`の値と一致しているか確認

### Backend: "Permission denied" エラー
- Service Accountに必要な権限があるか確認
- `terraform apply`が成功しているか確認

### Web: "Firebase authentication failed" エラー
- `FIREBASE_SERVICE_ACCOUNT` Secretが正しく設定されているか確認
- Service AccountにFirebase Hosting Admin権限があるか確認

### Workflowが実行されない
- 対象ディレクトリ (`backend/` or `mobile/`) のファイルが変更されているか確認
- `main`ブランチにpushしているか確認

