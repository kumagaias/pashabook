# 設計書: Pashabook MVP

## 概要

Pashabookは、子供の描いた絵をナレーション付きのアニメーション動画絵本に変換するAI搭載の絵本生成システムです。本システムは、Google CloudのAIサービス(Gemini 2.0 Flash、Imagen 3、Veo 3.1 Fast、Cloud TTS)を活用して、絵を分析し、年齢に適したストーリーを生成し、一貫性のあるイラストを作成し、アニメーションを制作し、最終動画を合成します。

MVPは、Gemini Live Agent Challengeハッカソンを対象とし、高速生成(3分未満)、バイリンガルサポート(日本語/英語)、クリーンなユーザーエクスペリエンスに焦点を当てています。本システムは、Google Cloud Platform上のサーバーレスアーキテクチャと非同期ジョブ処理を使用して、多段階の生成パイプラインを処理します。

### 主要な設計目標

- 高速生成パイプライン(エンドツーエンドで180秒未満)
- コスト効率とスケーラビリティのためのサーバーレスアーキテクチャ
- リアルタイム進捗追跡を伴う非同期処理
- 言語固有のAIモデルを使用したバイリンガルサポート
- グレースフルデグラデーション(VeoからFFmpegへのフォールバック)
- ハッカソンデモ目的の24時間データ保持

## アーキテクチャ

### 高レベルアーキテクチャ

```
┌─────────────┐
│ Mobile App  │
│(React Native│
│   + Expo)   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────────┐
│     Cloud Load Balancer                 │
└──────┬──────────────────────────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│  Cloud   │   │  Cloud   │   │  Cloud   │
│ Function │   │ Function │   │ Function │
│ (Upload) │   │ (Status) │   │ (Video)  │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     ▼              ▼              ▼
┌─────────────────────────────────────────┐
│           Firestore (Jobs)              │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Cloud Tasks (Queue)             │
│    (Veo 3.1 Fastのレート制限により      │
│     最大3個の同時ジョブ)                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      Cloud Run (Processing Worker)      │
│  ┌────────────────────────────────┐    │
│  │  1. Image Analysis (Gemini)    │    │
│  │     - クライマックス指標を識別 │    │
│  │                                │    │
│  │  2. Story Generation (Gemini)  │    │
│  │     - クライマックス指標を使用 │    │
│  │       して1〜2のハイライト     │    │
│  │       ページを選択             │    │
│  │                                │    │
│  │  3. 並列実行:                  │    │
│  │     ├─ Narration (Cloud TTS)   │    │
│  │     │  ページ単位、クリップ長  │    │
│  │     │  を決定                  │    │
│  │     └─ Illustration (Imagen 3) │    │
│  │        全ページを並列生成      │    │
│  │                                │    │
│  │  4. Animation (FFmpeg/Veo)     │    │
│  │     - ナレーション長を使用     │    │
│  │  5. Video Composition (FFmpeg) │    │
│  │     - クリップと音声を同期     │    │
│  └────────────────────────────────┘    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      Cloud Storage (Assets)             │
│  - Uploaded images                      │
│  - Generated illustrations              │
│  - Animation clips                      │
│  - Per-page narration audio             │
│  - Final videos                         │
│  (24時間TTL)                            │
└─────────────────────────────────────────┘
       │
       ▼ (ユーザーがライブラリに保存)
┌─────────────────────────────────────────┐
│   モバイルアプリローカルストレージ      │
│   (Library)                             │
│  - メタデータ用AsyncStorage             │
│  - 動画ファイル用FileSystem (50MB+)     │
│  - サーバー削除後も永続化               │
└─────────────────────────────────────────┘
```


### コンポーネントの責任

**フロントエンド (React Nativeモバイルアプリ)**
- 認証、アップロード、進捗追跡、プレビュー、ライブラリのユーザーインターフェース
- 言語選択とUIローカライゼーション
- セッション管理のためのAsyncStorage
- ライブラリのローカルストレージ管理(AsyncStorage + ファイルシステム)
- ジョブステータス更新のポーリング

**Cloud Functions**
- `upload`: Firebase IDトークンを検証し、画像アップロードを受け入れ、userIdを含むジョブを作成し、処理をキューに入れる
- `status`: Firebase IDトークンを検証し、ユーザーのジョブのみのジョブステータスと進捗情報を返す
- `video`: Firebase IDトークンを検証し、ユーザーのジョブのみの動画アクセス用の署名付きURLを生成する

**Cloud Run Worker**
- 完全な生成パイプラインを実行
- AIサービスとのやり取りを管理
- リトライとフォールバックロジックを処理
- Firestoreのジョブステータスを更新

**Firestore**
- ステータス、進捗、アセットURLを含むジョブレコードを保存
- リアルタイムステータス追跡を提供
- 24時間後のTTLベースのクリーンアップ

**Cloud Storage**
- すべての生成されたアセットを保存
- 安全なアクセスのための署名付きURLを提供
- 24時間保持のライフサイクルポリシー

**Cloud Tasks**
- 処理ジョブをキューに入れる
- 信頼性の高い非同期実行を保証
- 失敗時のリトライを処理

### 技術スタック

- **フロントエンド**: React Native (Expo)、TypeScript
- **バックエンド**: Node.js 20、Cloud Functions (2nd gen)、Cloud Run
- **認証**: Firebase Authentication (Email/Password)
- **AIサービス**: Gemini 2.0 Flash、Imagen 3、Veo 3.1 Fast、Cloud TTS
- **ストレージ**: Firestore、Cloud Storage、AsyncStorage (モバイルローカルストレージ)
- **キュー**: Cloud Tasks
- **動画処理**: FFmpeg
- **デプロイ**: Google Cloud Platform

## 認証アーキテクチャ

### Firebase Authentication統合

**認証フロー:**
1. ユーザーがモバイルアプリで登録/ログイン
2. Firebase Authenticationが認証情報を検証
3. ユーザープロファイルをFirestore `/users/{userId}` コレクションに保存
4. モバイルアプリがセッショントークンをAsyncStorageに保存
5. APIリクエストにAuthorizationヘッダーでFirebase IDトークンを含める
6. Cloud FunctionsがFirebase Admin SDKを使用してトークンを検証

**ユーザープロファイルスキーマ (Firestore):**
```typescript
interface UserProfile {
  userId: string // Firebase UID
  name: string
  email: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**セッション管理:**
- モバイル: AsyncStorageにFirebase IDトークンを保存
- トークン更新はFirebase SDKが自動処理
- ログアウト時にAsyncStorageをクリアしてトークンを無効化

**セキュリティ:**
- Firestoreセキュリティルールで認証済みユーザーのみデータアクセスを制限
- Jobレコードに`userId`フィールドを含めて所有権を検証
- ライブラリデータはユーザーセッションごとにローカル(AsyncStorage + FileSystem)に保存

## コンポーネントとインターフェース

### フロントエンドコンポーネント

#### Appコンポーネント
ルーティングと状態を管理するメインアプリケーションコンテナ。

```javascript
interface AppState {
  stage: 'upload' | 'processing' | 'preview' | 'library'
  language: 'ja' | 'en'
  currentJob: Job | null
  books: LibraryBook[]
}
```

#### UploadSectionコンポーネント
React Native画像ピッカーを使用して画像アップロードを処理。

```typescript
interface UploadSectionProps {
  onUpload: (imageUri: string) => Promise<void>
  language: 'ja' | 'en'
}
```

#### ProcessingSectionコンポーネント
ステータス更新を伴う生成進捗を表示。

```javascript
interface ProcessingSectionProps {
  jobId: string
  language: 'ja' | 'en'
}
```

#### PreviewSectionコンポーネント
タイトル編集と保存/ダウンロードオプションを備えた完成動画を表示。

```javascript
interface PreviewSectionProps {
  job: Job
  onSave: (title: string) => void
  onDownload: () => void
  language: 'ja' | 'en'
}
```

#### LibrarySectionコンポーネント
表示と削除アクションを備えた保存された絵本を表示。

```javascript
interface LibrarySectionProps {
  books: LibraryBook[]
  onView: (book: LibraryBook) => void
  onDelete: (bookId: string) => void
  language: 'ja' | 'en'
}
```

### バックエンドAPIエンドポイント

#### POST /api/upload
画像アップロードを受け入れ、処理ジョブを作成。

**リクエスト:**
```typescript
Headers:
  Authorization: Bearer <Firebase IDトークン>
Content-Type: multipart/form-data
{
  image: File (JPEG/PNG, < 10MB, >= 500x500px)
  language: 'ja' | 'en'
}
```

**レスポンス:**
```typescript
{
  jobId: string
  status: 'pending'
  createdAt: string (ISO 8601)
}
```

**エラー:**
- 401: 未認証(無効または欠落したFirebase IDトークン)
- 400: 無効なファイル形式、サイズ、または寸法
- 500: サーバーエラー

#### GET /api/status/:jobId
現在のジョブステータスと進捗を返す。

**リクエスト:**
```typescript
Headers:
  Authorization: Bearer <Firebase IDトークン>
```

**レスポンス:**
```typescript
{
  jobId: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: {
    stage: 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing'
    percentage: number (0-100)
  }
  result?: {
    title: string
    videoUrl: string
    storyText: string[]
  }
  error?: string
  updatedAt: string (ISO 8601)
}
```

**並列ステージに関する注記:** ナレーションとイラスト生成の並列実行中、システムは最初に開始されたプロセスのステージを報告します。ステージは、ナレーションとイラストの両方が完了した後にのみ'animating'に遷移します。

**エラー:**
- 401: 未認証(無効または欠落したFirebase IDトークン)
- 403: 禁止(ジョブは認証されたユーザーに属していません)
- 404: ジョブが見つからない
- 500: サーバーエラー

#### GET /api/video/:jobId
動画アクセス用の署名付きURLを生成。

**リクエスト:**
```typescript
Headers:
  Authorization: Bearer <Firebase IDトークン>
```

**レスポンス:**
```typescript
{
  videoUrl: string (署名付き、24時間有効)
  downloadUrl: string (署名付き、24時間有効)
  expiresAt: string (ISO 8601)
}
```

**エラー:**
- 401: 未認証(無効または欠落したFirebase IDトークン)
- 403: 禁止(ジョブは認証されたユーザーに属していません)
- 404: ジョブが見つからないか完了していない
- 500: サーバーエラー

### 処理パイプラインサービス

#### ImageAnalyzer
Gemini 2.0 Flashを使用してアップロードされた絵を分析。

```typescript
interface ImageAnalyzer {
  analyze(imageUrl: string, language: string): Promise<AnalysisResult>
}

interface AnalysisResult {
  characters: CharacterDescription[]
  setting: string
  style: string
  emotionalTone: string
  climaxIndicators: string[] // Story_GeneratorがHighlight_Pagesを選択する際に使用する主要な感情要素
}

interface CharacterDescription {
  name: string
  description: string
}
```

#### StoryGenerator
Gemini 2.0 Flashを使用してストーリーコンテンツを生成。

```typescript
interface StoryGenerator {
  generate(analysis: AnalysisResult, language: string): Promise<Story>
}

interface Story {
  title: string
  pages: StoryPage[]
}

interface StoryPage {
  pageNumber: number
  narrationText: string // 20-100語
  imagePrompt: string
  animationMode: 'standard' | 'highlight'
}
```

#### IllustrationGenerator
Imagen 3を使用してページイラストを作成。

```typescript
interface IllustrationGenerator {
  generateAll(pages: StoryPage[], style: string): Promise<Illustration[]>
}

interface Illustration {
  pageNumber: number
  imageUrl: string // Cloud Storage URL
  width: 1280
  height: 720
}
```

#### AnimationEngine
FFmpegまたはVeo 3.1 Fastを使用して動画アニメーションを作成。

```typescript
interface AnimationEngine {
  animateStandardPage(illustration: Illustration, narrationDuration: number): Promise<VideoClip>
  animateHighlightPage(illustration: Illustration, prompt: string, narrationDuration: number): Promise<VideoClip>
}

interface VideoClip {
  pageNumber: number
  videoUrl: string // Cloud Storage URL
  duration: number // 秒、ナレーションの長さに一致
  width: 1280
  height: 720
}

interface KenBurnsParams {
  zoomDirection: 'in' | 'out'
  panDirection: 'left' | 'right' | 'none'
}
```

#### NarrationGenerator
Cloud TTSを使用して音声ナレーションを作成。

```typescript
interface NarrationGenerator {
  generatePerPage(pageText: string, language: string): Promise<PageNarration>
  generateAll(pages: StoryPage[], language: string): Promise<PageNarration[]>
}

interface PageNarration {
  pageNumber: number
  audioUrl: string // Cloud Storage URL
  duration: number // 秒
  language: 'ja' | 'en'
}
```

**注記:** ナレーションはアニメーション生成前に個々のクリップの長さを決定するため、ページ単位で生成されます。`generateAll`メソッドは効率のためにページを並列で処理します。

#### VideoCompositor
FFmpegを使用してクリップと音声を結合。

```typescript
interface VideoCompositor {
  compose(clips: VideoClip[], pageNarrations: PageNarration[]): Promise<FinalVideo>
}

interface FinalVideo {
  videoUrl: string // Cloud Storage URL
  duration: number // 秒
  width: 1280
  height: 720
  format: 'mp4'
}
```

**注記:** コンポジターは各動画クリップを対応するページのナレーション音声と同期します。

## データモデル

### Firestoreスキーマ

#### Jobコレクション

```typescript
interface Job {
  jobId: string // ドキュメントID
  userId: string // このジョブを作成したユーザーのFirebase UID
  status: 'pending' | 'processing' | 'done' | 'error'
  language: 'ja' | 'en'
  
  // アセットURL
  uploadedImageUrl?: string
  illustrationUrls?: string[]
  animationClipUrls?: string[]
  narrationAudioUrls?: string[]
  finalVideoUrl?: string
  
  // 生成結果
  analysis?: AnalysisResult
  story?: Story
  
  // 進捗追跡
  currentStage?: 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing'
  progressPercentage?: number
  
  // エラー処理
  error?: string
  
  // タイムスタンプ
  createdAt: Timestamp
  updatedAt: Timestamp
  ttl: Timestamp // 作成から24時間
}
```

**インデックス:**
- `jobId` (主キー)
- `userId` (ユーザーのジョブクエリ用)
- `ttl` (クリーンアップ用)

### ローカルストレージスキーマ

#### ライブラリストレージ

```typescript
interface LibraryBook {
  id: string // 一意の識別子(タイムスタンプ)
  title: string // ユーザー編集可能なタイトル
  videoUri: string // デバイス上のローカルファイルURI
  thumbnailUri: string // ローカルサムネイルファイルURI
  createdAt: string // ISO 8601
}

// ストレージ: メタデータ用AsyncStorage
// キー: 'library_books'
// 値: JSON.stringify(LibraryBook[])
// 動画ファイル: React Native FileSystemを使用してアプリのドキュメントディレクトリに保存
```

**注記:** 動画はダウンロードされ、アプリのドキュメントディレクトリにファイルとして保存されます。メタデータ(タイトル、URI、タイムスタンプ)はAsyncStorageに保存されます。このアプローチは大容量動画ファイル(50MB+)をサポートし、24時間のサーバー削除ウィンドウ後もデータを永続化します。

### Cloud Storage構造

```
gs://pashabook-assets/
  jobs/
    {jobId}/
      uploaded/
        original.jpg
      illustrations/
        page-1.jpg
        page-2.jpg
        ...
      animations/
        page-1.mp4
        page-2.mp4
        ...
      narration/
        page-1.mp3
        page-2.mp3
        ...
      final/
        video.mp4
```

**ライフサイクルポリシー:**
- 24時間後にすべてのオブジェクトを削除


## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または動作です。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械で検証可能な正確性保証との橋渡しとして機能します。*

### プロパティ1: 有効な画像形式の受け入れ

*任意の*サイズと寸法の要件を満たすJPEGまたはPNG画像ファイルに対して、アップロードエンドポイントはファイルを受け入れ、有効なジョブIDを返すべきである。

**検証: 要件 2.1, 2.2, 2.5, 2.6, 2.7**

### プロパティ2: ジョブIDの一意性

*任意の*2つの有効な画像アップロードに対して、システムは異なるジョブIDを返すべきである。

**検証: 要件 2.7**

### プロパティ3: ハイライトページ数の制約

*任意の*生成されたストーリーに対して、指定されたハイライトページ（識別されたクライマックス指標を使用して選択）の数は1から2の範囲内であるべきである。

**検証: 要件 4.9**

### プロパティ4: 分析の永続化

*任意の*完了した画像分析に対して、ジョブレコードをクエリすると同じ分析結果が返されるべきである。

**検証: 要件 3.7**

### プロパティ5: ストーリーページ数の制約

*任意の*生成されたストーリーに対して、ページ数は5から6の範囲内であるべきである。

**検証: 要件 4.1**

### プロパティ6: キャラクター説明の組み込み

*任意の*生成されたストーリーに対して、分析からのすべてのキャラクター名は、少なくとも1つのページのナレーションテキストまたは画像プロンプトに現れるべきである。

**検証: 要件 4.3**

### プロパティ7: スタイル説明の組み込み

*任意の*生成されたストーリーに対して、分析からのスタイル説明はすべての画像プロンプトに現れるべきである。

**検証: 要件 4.4**

### プロパティ8: ストーリータイトルの存在

*任意の*生成されたストーリーに対して、タイトルフィールドは空でないべきである。

**検証: 要件 4.6**

### プロパティ9: ナレーション語数の制約

*任意の*ストーリーページに対して、ナレーションテキストは20から100語の範囲内であるべきである。

**検証: 要件 4.7**

### プロパティ10: 画像プロンプトの完全性

*任意の*生成されたストーリーに対して、すべてのページは空でない画像プロンプトを持つべきである。

**検証: 要件 4.8**

### プロパティ11: アニメーションモードの妥当性

*任意の*ストーリーページに対して、アニメーションモードは「standard」または「highlight」のいずれかであるべきである。

**検証: 要件 4.9**

### プロパティ12: ストーリーコンテンツの言語選択

*任意の*言語パラメータLを持つストーリー生成リクエストに対して、生成されたストーリーコンテンツは言語Lとして検出されるべきである。

**検証: 要件 4.10, 4.11**

### プロパティ13: イラスト数とページ数の一致

*任意の*Nページを持つ生成されたストーリーに対して、イラストジェネレーターは正確にN個のイラストを生成すべきである。

**検証: 要件 5.1**

### プロパティ14: イラストプロンプトのスタイル

*任意の*イラスト生成に対して、すべての画像プロンプトは分析からのスタイル説明を含むべきである。

**検証: 要件 5.2**

### プロパティ15: イラストプロンプトのキャラクター

*任意の*イラスト生成に対して、すべての画像プロンプトは分析からのキャラクター説明を含むべきである。

**検証: 要件 5.3**

### プロパティ16: イラストの解像度

*任意の*生成されたイラストに対して、画像の寸法は正確に1280x720ピクセルであるべきである。

**検証: 要件 5.5**

### プロパティ17: イラストのストレージ

*任意の*生成されたイラストに対して、画像は保存されたCloud Storage URLを介してアクセス可能であるべきである。

**検証: 要件 5.6**

### プロパティ18: ジョブレコードのイラストURL

*任意の*完了したイラスト生成に対して、ジョブレコードはすべての生成されたイラストのURLを含むべきである。

**検証: 要件 5.7**

### プロパティ19: 標準ページアニメーションの完全性

*任意の*N個の標準ページを持つストーリーに対して、アニメーションエンジンは正確にN個の標準ページアニメーションを生成すべきである。

**検証: 要件 6.1**

### プロパティ20: ズーム方向の妥当性

*任意の*標準ページアニメーションに対して、ズーム方向は「in」または「out」のいずれかであるべきである。

**検証: 要件 6.3**

### プロパティ21: パン方向の妥当性

*任意の*標準ページアニメーションに対して、パン方向は「left」、「right」、または「none」のいずれかであるべきである。

**検証: 要件 6.4**

### プロパティ22: 標準ページクリップの長さ

*任意の*標準ページアニメーションクリップに対して、長さはそのページのナレーション音声の長さと一致すべきである(±0.1秒の許容範囲)。

**検証: 要件 6.5**

### プロパティ23: アニメーションクリップのストレージ

*任意の*生成されたアニメーションクリップに対して、動画は保存されたCloud Storage URLを介してアクセス可能であるべきである。

**検証: 要件 6.7**

### プロパティ24: ジョブレコードのアニメーションURL

*任意の*完了したアニメーション生成に対して、ジョブレコードはすべてのアニメーションクリップのURLを含むべきである。

**検証: 要件 6.8**

### プロパティ25: ハイライトページアニメーションの完全性

*任意の*M個のハイライトページを持つストーリーに対して、アニメーションエンジンは正確にM個のハイライトページアニメーションを生成すべきである。

**検証: 要件 7.1**

### プロパティ26: ハイライトページクリップの長さ

*任意の*ハイライトページアニメーションクリップに対して、長さはそのページのナレーション音声の長さと一致すべきである(±0.1秒の許容範囲)。

**検証: 要件 7.2**

### プロパティ27: ハイライトクリップのストレージ

*任意の*生成されたハイライトページクリップに対して、動画は保存されたCloud Storage URLを介してアクセス可能であるべきである。

**検証: 要件 7.6**

### プロパティ28: ジョブレコードのハイライトURL

*任意の*完了したハイライトページ生成に対して、ジョブレコードはすべてのハイライトページクリップのURLを含むべきである。

**検証: 要件 7.7**

### プロパティ29: ナレーション生成

*任意の*完了したストーリー生成に対して、ナレーションジェネレーターは空でない音声ファイルを生成すべきである。

**検証: 要件 8.1**

### プロパティ30: ナレーションのストレージ

*任意の*生成されたナレーション音声に対して、ファイルは保存されたCloud Storage URLを介してアクセス可能であるべきである。

**検証: 要件 8.5**

### プロパティ31: ジョブレコードのナレーションURL

*任意の*完了したナレーション生成に対して、ジョブレコードはナレーション音声URLを含むべきである。

**検証: 要件 8.6**

### プロパティ32: 動画クリップ数

*任意の*Nページを持つ動画合成に対して、最終動画は正確にN個のクリップを含むべきである。

**検証: 要件 9.1**

### プロパティ33: 音声と動画の同期

*任意の*最終動画に対して、ナレーション音声の長さは動画の長さと一致すべきである(±0.5秒の許容範囲)。

**検証: 要件 9.3**

### プロパティ34: 最終動画の解像度

*任意の*最終動画に対して、寸法は正確に1280x720ピクセルであるべきである。

**検証: 要件 9.4**

### プロパティ35: 最終動画の形式

*任意の*最終動画に対して、ファイル形式はMP4であるべきである。

**検証: 要件 9.5**

### プロパティ36: 最終動画のストレージ

*任意の*生成された最終動画に対して、ファイルは保存されたCloud Storage URLを介してアクセス可能であるべきである。

**検証: 要件 9.6**

### プロパティ37: 完了時のジョブステータス更新

*任意の*完了した動画合成に対して、ジョブステータスは「done」であり、ジョブレコードは最終動画URLを含むべきである。

**検証: 要件 9.7**

### プロパティ38: 処理中へのジョブステータス遷移

*任意の*生成を開始するジョブに対して、ステータスは「pending」から「processing」に遷移すべきである。

**検証: 要件 10.1**

### プロパティ39: 完了へのジョブステータス遷移

*任意の*正常に完了するジョブに対して、ステータスは「done」に遷移すべきである。

**検証: 要件 10.2**

### プロパティ40: エラーへのジョブステータス遷移

*任意の*コンポーネントが失敗するジョブに対して、ステータスは「error」に遷移すべきである。

**検証: 要件 10.3**

### プロパティ41: エラーメッセージの保存

*任意の*ステータスが「error」のジョブに対して、ジョブレコードは空でないエラーメッセージを含むべきである。

**検証: 要件 10.4**

### プロパティ42: タイムスタンプの更新

*任意の*ジョブステータス変更に対して、updatedAtタイムスタンプは以前のupdatedAt値よりも新しいべきである。

**検証: 要件 10.5**

### プロパティ43: ジョブクエリのラウンドトリップ

*任意の*ID Jで作成されたジョブに対して、ID Jでステータスエンドポイントをクエリすると、同じIDを持つジョブレコードが返されるべきである。

**検証: 要件 10.6**

### プロパティ44: 署名付きURLの生成

*任意の*完了したジョブに対して、動画エンドポイントはアクセス可能で24時間有効な署名付きURLを返すべきである。

**検証: 要件 11.1**

### プロパティ45: ダウンロードリンクの可用性

*任意の*完了したジョブに対して、動画エンドポイントは空でないダウンロードURLを返すべきである。

**検証: 要件 11.2**

### プロパティ46: 動画とともにタイトルを表示

*任意の*プレビューセクションに表示される完了したジョブに対して、UIはストーリータイトルを表示すべきである。

**検証: 要件 11.4**

### プロパティ47: 動画とともにストーリーテキストを表示

*任意の*プレビューセクションに表示される完了したジョブに対して、UIはすべてのページのストーリーテキストを表示すべきである。

**検証: 要件 11.5**

### プロパティ48: UI言語選択

*任意の*言語選択変更に対して、すべてのUIテキストは選択された言語に更新されるべきである。

**検証: 要件 12.3**

### プロパティ49: ストーリーコンテンツの言語

*任意の*言語Lを持つ生成リクエストに対して、生成されたストーリーコンテンツは言語Lであるべきである。

**検証: 要件 12.4**

### プロパティ50: ナレーションの言語

*任意の*言語Lを持つ生成リクエストに対して、ナレーション音声は言語Lであるべきである。

**検証: 要件 12.5**

### プロパティ51: ライブラリ保存機能

*任意の*保存される完了した絵本に対して、ライブラリはその絵本のエントリを含むべきである。

**検証: 要件 13.1**

### プロパティ52: ローカルストレージの永続化

*任意の*保存された絵本に対して、動画ファイルはデバイスのファイルシステムから取得可能であり、メタデータはAsyncStorageから取得可能であるべきである。

**検証: 要件 13.2, 13.3, 13.6, 13.7**

### プロパティ53: ライブラリ表示の完全性

*任意の*N個の保存された絵本を持つライブラリに対して、ライブラリビューは正確にN個の絵本カードを表示すべきである。

**検証: 要件 13.4**

### プロパティ54: ライブラリ削除機能

*任意の*ライブラリから削除された絵本に対して、ライブラリはその絵本を含まなくなるべきである。

**検証: 要件 13.5**

### プロパティ55: 保存された絵本のフィールド

*任意の*保存された絵本に対して、保存されたデータはタイトル、動画ファイルURI、サムネイルURI、作成タイムスタンプのフィールドを含むべきである。

**検証: 要件 13.7**

### プロパティ56: ライブラリのサムネイル表示

*任意の*ライブラリビューの絵本に対して、サムネイル画像が表示されるべきである。

**検証: 要件 13.8**

### プロパティ57: デフォルトタイトルの表示

*任意の*新しく生成された絵本に対して、プレビューは最初にAI生成タイトルを表示すべきである。

**検証: 要件 14.1**

### プロパティ58: タイトル編集機能

*任意の*プレビューの絵本に対して、タイトルフィールドを編集すると表示されるタイトルが更新されるべきである。

**検証: 要件 14.2**

### プロパティ59: カスタムタイトルの永続化

*任意の*保存される編集されたタイトルに対して、絵本を再読み込みするとカスタムタイトルが表示されるべきである。

**検証: 要件 14.3**

### プロパティ60: ライブラリのカスタムタイトル

*任意の*カスタムタイトルを持つ絵本に対して、ライブラリビューは元のタイトルではなくカスタムタイトルを表示すべきである。

**検証: 要件 14.4**

### プロパティ61: アップロードエラーメッセージ

*任意の*失敗した画像アップロードに対して、UIは空でないエラーメッセージを表示すべきである。

**検証: 要件 17.1**

### プロパティ62: 生成エラーメッセージ

*任意の*失敗した生成に対して、UIは空でないエラーメッセージを表示すべきである。

**検証: 要件 17.2**

### プロパティ63: ネットワークエラーの再試行オプション

*任意の*ネットワークエラーに対して、UIは再試行オプションを表示すべきである。

**検証: 要件 17.3**

### プロパティ64: エラーログ

*任意の*発生したエラーに対して、Cloud Loggingにエントリが作成されるべきである。

**検証: 要件 17.4**

### プロパティ65: エラーメッセージのサニタイズ

*任意の*ユーザーに表示されるエラーメッセージに対して、メッセージは内部実装の詳細(スタックトレース、ファイルパス、データベースクエリ)を含まないべきである。

**検証: 要件 17.5**


## エラー処理

### アップロード検証エラー

**ファイル形式エラー**
- トリガー: JPEG/PNG以外のファイルがアップロードされた
- レスポンス: 400 Bad Request
- メッセージ: 「JPEGまたはPNG画像ファイルをアップロードしてください」

**ファイルサイズエラー**
- トリガー: ファイルが10MBを超える
- レスポンス: 400 Bad Request
- メッセージ: 「画像ファイルは10MB未満である必要があります」

**寸法エラー**
- トリガー: 画像が500x500ピクセル未満
- レスポンス: 400 Bad Request
- メッセージ: 「画像は少なくとも500x500ピクセルである必要があります」

### 生成エラー

**AIサービスタイムアウト**
- トリガー: Gemini/Imagen/Veoリクエストがタイムアウトを超える
- アクション: 指数バックオフで最大3回リトライ
- フォールバック: Veoタイムアウトの場合、FFmpeg ケンバーンズ効果を使用
- ジョブステータス: すべてのリトライが失敗した場合「error」
- メッセージ: 「生成がタイムアウトしました。もう一度お試しください。」

**AIサービスエラー**
- トリガー: Gemini/Imagen/Veoがエラーレスポンスを返す
- アクション: 最大3回リトライ
- フォールバック: Veoエラーの場合、FFmpeg ケンバーンズ効果を使用
- ジョブステータス: すべてのリトライが失敗した場合「error」
- メッセージ: 「AIサービスエラー。もう一度お試しください。」

**ストレージエラー**
- トリガー: Cloud Storageのアップロード/ダウンロードが失敗
- アクション: 最大3回リトライ
- ジョブステータス: すべてのリトライが失敗した場合「error」
- メッセージ: 「ストレージエラー。もう一度お試しください。」

**FFmpegエラー**
- トリガー: 動画処理が失敗
- アクション: 1回リトライ
- ジョブステータス: リトライが失敗した場合「error」
- メッセージ: 「動画処理エラー。もう一度お試しください。」

### ネットワークエラー

**フロントエンドネットワークエラー**
- トリガー: ネットワークによりAPIリクエストが失敗
- アクション: 再試行ボタンを表示
- メッセージ: 「ネットワークエラー。接続を確認してもう一度お試しください。」

**バックエンドネットワークエラー**
- トリガー: 外部サービスに到達できない
- アクション: 指数バックオフでリトライ
- ログ: 完全なエラー詳細をCloud Loggingに記録

### エラーログ戦略

すべてのエラーは以下の情報とともにCloud Loggingに記録されます:
- エラータイプとメッセージ
- ジョブID(該当する場合)
- タイムスタンプ
- スタックトレース(サーバー側のみ)
- リクエストコンテキスト

ユーザー向けエラーメッセージは以下を削除するようにサニタイズされます:
- スタックトレース
- ファイルパス
- データベースクエリ
- APIキーまたは認証情報
- 内部サービス名

## テスト戦略

### デュアルテストアプローチ

システムは包括的なカバレッジのために、ユニットテストとプロパティベーステストの両方を必要とします:

**ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- 特定の無効なファイルでのアップロード検証
- ケンバーンズ効果の適用
- クロスフェードトランジションのタイミング
- 言語固有の音声選択
- Veoフォールバックシナリオ
- モバイル動画再生の互換性

**プロパティベーステスト**: すべての入力にわたる普遍的なプロパティを検証
- プロパティテストごとに最低100回の反復を実行
- ランダム化された入力を使用してエッジケースを発見
- 各テストに機能名とプロパティ番号でタグ付け
- 正確性プロパティセクションで定義されたプロパティに焦点を当てる

### プロパティベーステスト設定

**ライブラリ**: fast-check (JavaScript/TypeScript)

**テスト構造**:
```javascript
import fc from 'fast-check'

// Feature: pashabook-mvp, Property 1: Valid Image Format Acceptance
test('accepts valid JPEG and PNG images', () => {
  fc.assert(
    fc.property(
      fc.oneof(validJpegArbitrary(), validPngArbitrary()),
      async (imageFile) => {
        const response = await uploadImage(imageFile)
        expect(response.jobId).toBeDefined()
        expect(response.status).toBe('pending')
      }
    ),
    { numRuns: 100 }
  )
})
```

**ジェネレーター(Arbitraries)**:
- 有効な画像ファイル(JPEG/PNG、さまざまなサイズ)
- 異なる状態のジョブレコード
- さまざまなページ数のストーリーコンテンツ
- アニメーションパラメータ
- 言語選択

### ユニットテストの焦点領域

**アップロード検証**
- 特定の無効な形式をテスト(GIF、BMP、WEBP)
- 正確な境界条件をテスト(10MB、500x500px)
- 破損したファイル処理をテスト

**AI統合**
- AIサービスレスポンスをモック
- 特定の失敗シナリオでリトライロジックをテスト
- タイムアウト処理をテスト

**動画処理**
- FFmpegコマンド生成をテスト
- ケンバーンズ効果パラメータをテスト
- クロスフェードトランジションのタイミングをテスト(0.5秒)
- 音声と動画の同期をテスト

**フロントエンド**
- 言語切り替えをテスト
- ライブラリCRUD操作をテスト
- タイトル編集をテスト
- 進捗表示の更新をテスト

**エラー処理**
- すべてのエラーメッセージ形式をテスト
- 再試行ボタン機能をテスト
- エラーメッセージのサニタイズをテスト

### 統合テスト

**エンドツーエンドフロー**
- アップロード → 分析 → ストーリー → イラスト → アニメーション → ナレーション → 合成
- サンプル絵でテスト
- 最終動画再生を検証
- 24時間有効期限を検証

**API統合**
- すべてのAPIエンドポイントをテスト
- 署名付きURL生成と有効期限をテスト
- 同時ジョブ処理をテスト

### カバレッジ目標

- 全体: 60%以上
- クリティカルパス(アップロード、Veo統合を除く生成パイプライン): 80%以上
- 新しいコード: 80%以上

**注記:** Veo 3.1 Fast統合は外部API依存のため、クリティカルパスのカバレッジ要件から除外されます。Veo機能はモックでテストされ、手動統合テストで検証されます。

### テストコマンド

```bash
make test              # すべてのテスト
make test-unit         # ユニットテストのみ
make test-property     # プロパティベーステストのみ
make test-e2e          # エンドツーエンドテスト
make test -- --coverage # カバレッジレポート付き
```

