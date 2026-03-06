# 要件定義書

## はじめに

Pashabookは、子供の描いた絵をアニメーション付きのナレーション絵本に変換するAI搭載の絵本生成システムです。本システムは、アップロードされた絵を分析し、年齢に適したストーリーを生成し、一貫性のあるイラストを作成し、アニメーションを制作し、すべてを共有可能な動画形式に統合します。本文書は、Gemini Live Agent Challengeハッカソンを対象としたMVP実装の要件を定義します。

## 用語集

- **Pashabook_System**: AI搭載の絵本生成システム全体
- **Image_Analyzer**: アップロードされた絵を分析するGemini 2.0 Flashコンポーネント
- **Story_Generator**: ストーリーコンテンツを作成するGemini 2.0 Flashコンポーネント
- **Illustration_Generator**: ページイラストを作成するImagen 3コンポーネント
- **Animation_Engine**: FFmpegまたはVeo 3.1 Fastを使用して動画アニメーションを作成するコンポーネント
- **Narration_Generator**: 音声ナレーションを作成するGoogle Cloud TTSコンポーネント
- **Video_Compositor**: クリップ、音声、トランジションを結合するFFmpegコンポーネント
- **User**: 子供の絵をアップロードする保護者
- **Drawing**: JPEGまたはPNG画像としてアップロードされた子供の作品
- **Storybook**: ストーリーテキスト、イラスト、アニメーション、ナレーションで構成される完全な出力
- **Standard_Page**: FFmpegを使用したケンバーンズ効果でアニメーション化されたストーリーページ
- **Highlight_Page**: 視覚的インパクトを高めるためにVeo 3.1 Fastでアニメーション化されたストーリーページ
- **Style_Description**: 元の絵から抽出された視覚的特徴
- **Character_Description**: ページ間の一貫性のために抽出されたキャラクター属性
- **Ken_Burns_Effect**: 静止画像に適用されるパンとズームのアニメーション技法
- **Job**: Firestoreで追跡される非同期処理タスク
- **Library**: ユーザーが生成した絵本のモバイルアプリローカルストレージコレクション（メタデータ用AsyncStorage、動画ファイル用FileSystem）

## 要件

### 要件1: ユーザー認証

**ユーザーストーリー:** ユーザーとして、アカウントを作成してサインインし、絵本を保存・管理できるようにしたい

#### 受け入れ基準

1. THE Pashabook_System SHALL 名前、メールアドレス、パスワードを受け付ける登録インターフェースを提供する
2. WHEN ユーザーが登録する場合、THE Pashabook_System SHALL メールアドレスの形式を検証する
3. WHEN ユーザーが登録する場合、THE Pashabook_System SHALL パスワードの最小長を6文字とする
4. WHEN ユーザーが登録する場合、THE Pashabook_System SHALL Firebase Authenticationを使用してユーザーアカウントを作成する
5. WHEN ユーザーが登録する場合、THE Pashabook_System SHALL ユーザープロファイル(名前、メールアドレス)をCloud Firestoreに保存する
6. WHEN ユーザーが登録する場合、THE Pashabook_System SHALL 一意のユーザーID(Firebase UID)を作成する
7. THE Pashabook_System SHALL メールアドレスとパスワードを受け付けるログインインターフェースを提供する
8. WHEN ユーザーが有効な認証情報でログインする場合、THE Pashabook_System SHALL 認証済みセッションを作成する
9. WHEN ユーザーが無効な認証情報でログインする場合、THE Pashabook_System SHALL エラーメッセージを返す
10. THE Pashabook_System SHALL AsyncStorageを使用してモバイルアプリでユーザーセッション状態を維持する
11. THE Pashabook_System SHALL セッションをクリアするログアウト機能を提供する

**実装注記:** MVPでは、Firebase Authentication（Email/Passwordプロバイダー）を使用します。パスワードはFirebase Authenticationによって安全に管理されます（Firestoreには保存されません）。ユーザープロファイルデータ（名前、メールアドレス、userId）のみがCloud Firestoreに保存されます。モバイルアプリはAsyncStorageを使用してセッション状態をローカルで維持します。

### 要件2: 画像アップロードと検証

**ユーザーストーリー:** ユーザーとして、子供の絵をアップロードして、システムがそれから絵本を作成できるようにしたい

#### 受け入れ基準

1. THE Pashabook_System SHALL JPEG形式の画像アップロードを受け付ける
2. THE Pashabook_System SHALL PNG形式の画像アップロードを受け付ける
3. WHEN 画像が10MBを超える場合、THE Pashabook_System SHALL 説明的なエラーメッセージとともにアップロードを拒否する
4. WHEN 画像が500x500ピクセル未満の場合、THE Pashabook_System SHALL 説明的なエラーメッセージとともにアップロードを拒否する
5. WHEN 有効な画像がアップロードされた場合、THE Pashabook_System SHALL 画像をCloud Storageに保存する
6. WHEN 有効な画像がアップロードされた場合、THE Pashabook_System SHALL ステータス「pending」のJobレコードをFirestoreに作成する
7. WHEN 有効な画像がアップロードされた場合、THE Pashabook_System SHALL 2秒以内にユーザーに一意のJob識別子を返す

### 要件3: 絵の分析

**ユーザーストーリー:** ユーザーとして、システムが子供の絵を理解して、生成されたストーリーが作品と一致するようにしたい

#### 受け入れ基準

1. WHEN Jobが作成された場合、THE Image_Analyzer SHALL Drawingからキャラクター名と説明を抽出する
2. WHEN Jobが作成された場合、THE Image_Analyzer SHALL Drawingから背景と設定情報を抽出する
3. WHEN Jobが作成された場合、THE Image_Analyzer SHALL Drawingから画風の特徴を抽出する
4. WHEN Jobが作成された場合、THE Image_Analyzer SHALL Drawingから感情トーンを抽出する
5. WHEN Jobが作成された場合、THE Image_Analyzer SHALL Story_GeneratorがHighlight_Pagesを選択する際に使用するため、Drawingの主要な感情要素とクライマックス指標を識別する
6. THE Image_Analyzer SHALL 30秒以内に分析を完了する
7. THE Image_Analyzer SHALL 分析結果をJobレコードに保存する

### 要件4: ストーリー生成

**ユーザーストーリー:** ユーザーとして、絵から年齢に適したストーリーを生成して、子供と共有できるようにしたい

#### 受け入れ基準

1. WHEN 絵の分析が完了した場合、THE Story_Generator SHALL 5〜6ページのストーリーを作成する
2. THE Story_Generator SHALL 3〜8歳の子供に適した語彙を使用する
3. THE Story_Generator SHALL 分析からのCharacter_Descriptionsを組み込む
4. THE Story_Generator SHALL 分析からのStyle_Descriptionを組み込む
5. THE Story_Generator SHALL 分析からの感情トーンを組み込む
6. THE Story_Generator SHALL ストーリータイトルを生成する
7. THE Story_Generator SHALL 各ページに20〜100語のナレーションテキストを作成する
8. THE Story_Generator SHALL 各ページに画像生成プロンプトを作成する
9. THE Story_Generator SHALL 分析からのクライマックス指標を使用して、ストーリーのクライマックスポイント（最も感情的な強度が高い、または重要なプロットの瞬間）に基づいて1〜2ページをHighlight_Pagesとして指定する
10. THE Story_Generator SHALL 各ページのアニメーションモードを「standard」または「highlight」として指定する
11. WHERE ユーザーが日本語を選択した場合、THE Story_Generator SHALL 日本語でストーリーコンテンツを生成する
12. WHERE ユーザーが英語を選択した場合、THE Story_Generator SHALL 英語でストーリーコンテンツを生成する
13. THE Story_Generator SHALL 30秒以内に生成を完了する

### 要件5: イラスト生成

**ユーザーストーリー:** ユーザーとして、子供の絵のスタイルに合ったイラストを作成して、絵本に一体感を持たせたい

#### 受け入れ基準

1. WHEN ストーリー生成が完了した場合、THE Illustration_Generator SHALL ストーリーページごとに1つのイラストを作成する
2. THE Illustration_Generator SHALL 各イラストプロンプトにStyle_Descriptionを組み込む
3. THE Illustration_Generator SHALL 各イラストプロンプトにCharacter_Descriptionsを組み込む
4. THE Illustration_Generator SHALL すべてのページイラストを並列で生成する
5. THE Illustration_Generator SHALL 1280x720ピクセル解像度でイラストを生成する
6. THE Illustration_Generator SHALL 生成されたイラストをCloud Storageに保存する
7. THE Illustration_Generator SHALL イラストURLでJobレコードを更新する
8. THE Illustration_Generator SHALL 90秒以内にすべてのイラストを完了する

### 要件6: 標準ページアニメーション

**ユーザーストーリー:** ユーザーとして、絵本にアニメーションページを作成して、視聴体験を魅力的にしたい

#### 受け入れ基準

1. WHEN イラスト生成が完了した場合、THE Animation_Engine SHALL すべてのStandard_Pagesのアニメーションを作成する
2. THE Animation_Engine SHALL Standard_PageイラストにKen_Burns_Effectを適用する
3. THE Animation_Engine SHALL 各Standard_Pageのズーム方向をズームインまたはズームアウトからランダムに選択する
4. THE Animation_Engine SHALL 各Standard_Pageのパン方向を左、右、またはなしからランダムに選択する
5. THE Animation_Engine SHALL 各Standard_Pageに対して、そのページのナレーション音声の長さに一致する動画クリップを作成する
6. THE Animation_Engine SHALL Standard_Pageアニメーションを並列で生成する
7. THE Animation_Engine SHALL アニメーションクリップをCloud Storageに保存する
8. THE Animation_Engine SHALL アニメーションクリップURLでJobレコードを更新する

### 要件7: ハイライトページアニメーション

**ユーザーストーリー:** ユーザーとして、ストーリーのクライマックスポイントに特別なアニメーションページを作成して、絵本に記憶に残る瞬間を持たせたい

#### 受け入れ基準

1. WHEN イラスト生成が完了した場合、THE Animation_Engine SHALL Veo 3.1 Fastを使用してすべてのHighlight_Pagesのアニメーションを作成する
2. THE Animation_Engine SHALL 各Highlight_Pageに対して、そのページのナレーション音声の長さに一致する動画クリップを作成する
3. THE Animation_Engine SHALL Highlight_Page生成を非同期で実行する
4. IF Veo 3.1 Fast生成が失敗した場合、THEN THE Animation_Engine SHALL フォールバックとしてKen_Burns_Effectを適用する
5. IF Veo 3.1 Fast生成が60秒を超えた場合、THEN THE Animation_Engine SHALL フォールバックとしてKen_Burns_Effectを適用する
6. THE Animation_Engine SHALL Highlight_PageクリップをCloud Storageに保存する
7. THE Animation_Engine SHALL Highlight_PageクリップURLでJobレコードを更新する

### 要件8: ナレーション生成

**ユーザーストーリー:** ユーザーとして、ストーリーのナレーション音声を作成して、読まずに子供に再生できるようにしたい

#### 受け入れ基準

1. WHEN ストーリー生成が完了した場合、THE Narration_Generator SHALL ストーリーテキストから音声ナレーションを作成する
2. WHERE ストーリー言語が日本語の場合、THE Narration_Generator SHALL 日本語の音声を使用する
3. WHERE ストーリー言語が英語の場合、THE Narration_Generator SHALL 英語の音声を使用する
4. THE Narration_Generator SHALL 温かく優しい声のトーンを使用する
5. THE Narration_Generator SHALL ナレーション音声ファイルをCloud Storageに保存する（ページごとに1ファイル）
6. THE Narration_Generator SHALL ナレーション音声URLs（全ページのURLの配列）でJobレコードを更新する
7. THE Narration_Generator SHALL 全ページのナレーションを合計30秒以内に完了する

### 要件9: 動画合成

**ユーザーストーリー:** ユーザーとして、完全な動画ファイルを作成して、絵本を簡単に共有および再生できるようにしたい

#### 受け入れ基準

1. WHEN すべてのアニメーションとナレーションが完了した場合、THE Video_Compositor SHALL すべてのページクリップを1つの動画に結合する
2. THE Video_Compositor SHALL ページ間に0.5秒のクロスフェードトランジションを適用する
3. THE Video_Compositor SHALL ナレーション音声を動画タイムラインと同期する
4. THE Video_Compositor SHALL 1280x720ピクセル解像度で出力動画を生成する
5. THE Video_Compositor SHALL MP4形式で出力動画を生成する
6. THE Video_Compositor SHALL 最終動画をCloud Storageに保存する
7. THE Video_Compositor SHALL 最終動画URLとステータス「done」でJobレコードを更新する
8. THE Video_Compositor SHALL 60秒以内に合成を完了する

### 要件10: 進捗追跡

**ユーザーストーリー:** ユーザーとして、生成の進捗を確認して、システムが動作していることを知りたい

#### 受け入れ基準

1. THE Pashabook_System SHALL 生成が開始されたときにJobステータスを「processing」に更新する
2. THE Pashabook_System SHALL 動画合成が完了したときにJobステータスを「done」に更新する
3. THE Pashabook_System SHALL いずれかのコンポーネントが失敗したときにJobステータスを「error」に更新する
4. WHEN Jobステータスが「error」の場合、THE Pashabook_System SHALL エラーメッセージをJobレコードに保存する
5. THE Pashabook_System SHALL 各ステータス変更時にJobタイムスタンプを更新する
6. THE Pashabook_System SHALL クライアントがJob識別子でJobステータスをクエリできるようにする

### 要件11: 動画プレビューとダウンロード

**ユーザーストーリー:** ユーザーとして、絵本動画をプレビューおよびダウンロードして、子供と共有できるようにしたい

#### 受け入れ基準

1. WHEN Jobステータスが「done」の場合、THE Pashabook_System SHALL 24時間有効な動画プレビュー用の署名付きURLを提供する
2. WHEN Jobステータスが「done」の場合、THE Pashabook_System SHALL 動画ファイルのダウンロードリンクを提供する
3. THE Pashabook_System SHALL モバイルアプリでの動画再生を許可する
4. THE Pashabook_System SHALL 動画とともにストーリータイトルを表示する
5. THE Pashabook_System SHALL 動画と並べてストーリーテキストを表示する

**セキュリティ注記:** Jobレコードには`userId`フィールドが含まれます。APIエンドポイントは、認証済みユーザーが自分のジョブのみにアクセスできることを検証します。Job IDは追加のセキュリティのためにUUIDです。

### 要件12: 言語サポート

**ユーザーストーリー:** ユーザーとして、希望する言語を選択して、絵本が子供の言語と一致するようにしたい

#### 受け入れ基準

1. THE Pashabook_System SHALL 日本語の言語選択をサポートする
2. THE Pashabook_System SHALL 英語の言語選択をサポートする
3. WHEN 言語が選択された場合、THE Pashabook_System SHALL 選択された言語でUIテキストを表示する
4. WHEN 言語が選択された場合、THE Pashabook_System SHALL 選択された言語でストーリーコンテンツを生成する
5. WHEN 言語が選択された場合、THE Pashabook_System SHALL 選択された言語でナレーションを生成する

### 要件13: ローカルライブラリ管理

**ユーザーストーリー:** ユーザーとして、絵本をデバイスにローカル保存および管理して、後でアクセスできるようにしたい

#### 受け入れ基準

1. WHEN 絵本が完成した場合、THE Pashabook_System SHALL ユーザーがLibraryに保存できるようにする
2. THE Pashabook_System SHALL LibraryメタデータをモバイルアプリのAsyncStorageに保存する
3. THE Pashabook_System SHALL 動画ファイルをモバイルアプリのFileSystem（ドキュメントディレクトリ）に保存する
4. THE Pashabook_System SHALL Library表示にすべての保存された絵本を表示する
5. THE Pashabook_System SHALL ユーザーがLibraryから絵本を削除できるようにする
6. WHEN 絵本が保存された場合、THE Pashabook_System SHALL 動画ファイルをダウンロードしてデバイスにローカル保存する
7. THE Pashabook_System SHALL タイトル、動画ファイルURI、サムネイルURI、作成タイムスタンプをAsyncStorageに保存する
8. THE Pashabook_System SHALL Library表示に絵本のサムネイルを表示する
9. THE Pashabook_System SHALL サーバーアクセスを必要とせずにローカルストレージから保存された絵本を再生する

**実装注記:** React Native FileSystemを使用して、大容量の動画ファイル(50MB+)をアプリのドキュメントディレクトリに保存します。メタデータ(タイトル、URI、タイムスタンプ)はAsyncStorageに保存されます。このアプローチは大容量ファイルをサポートし、24時間のサーバー削除ウィンドウ後もデータを永続化します。

### 要件14: タイトル管理

**ユーザーストーリー:** ユーザーとして、絵本のタイトルをカスタマイズして、パーソナライズしたい

#### 受け入れ基準

1. THE Pashabook_System SHALL AI生成タイトルをデフォルトとして表示する
2. THE Pashabook_System SHALL ユーザーが絵本のタイトルを編集できるようにする
3. WHEN ユーザーがタイトルを編集した場合、THE Pashabook_System SHALL カスタムタイトルを保存する
4. THE Pashabook_System SHALL Library表示にカスタムタイトルを表示する

### 要件15: データ保持

**ユーザーストーリー:** システム管理者として、自動データクリーンアップを実行して、ストレージコストを管理可能に保ちたい

#### 受け入れ基準

1. THE Pashabook_System SHALL 24時間後にアップロードされた画像をCloud Storageから削除する
2. THE Pashabook_System SHALL 24時間後に生成されたイラストをCloud Storageから削除する
3. THE Pashabook_System SHALL 24時間後にアニメーションクリップをCloud Storageから削除する
4. THE Pashabook_System SHALL 24時間後に最終動画をCloud Storageから削除する
5. THE Pashabook_System SHALL 24時間後にJobレコードをFirestoreから削除する

### 要件16: パフォーマンス目標

**ユーザーストーリー:** ユーザーとして、絵本生成を高速化して、長時間待たなくて済むようにしたい

#### 受け入れ基準

1. THE Pashabook_System SHALL 生成パイプライン全体を180秒以内に完了する
2. THE Pashabook_System SHALL アップロードリクエストに2秒以内に応答する
3. THE Pashabook_System SHALL ステータスクエリに1秒以内に応答する
4. THE Pashabook_System SHALL 3個の同時Job実行をサポートする（Veo 3.1 Fast APIのレート制限による制約）

### 要件17: エラー処理

**ユーザーストーリー:** ユーザーとして、明確なエラーメッセージを表示して、何が問題だったかを理解したい

#### 受け入れ基準

1. WHEN 画像アップロードが失敗した場合、THE Pashabook_System SHALL 説明的なエラーメッセージを表示する
2. WHEN 生成が失敗した場合、THE Pashabook_System SHALL 説明的なエラーメッセージを表示する
3. WHEN ネットワークエラーが発生した場合、THE Pashabook_System SHALL 再試行オプションを表示する
4. THE Pashabook_System SHALL すべてのエラーをCloud Loggingに記録する
5. THE Pashabook_System SHALL 内部エラーの詳細をユーザーに公開しない
