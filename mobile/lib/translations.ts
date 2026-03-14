export const translations = {
  en: {
    // Auth
    login: "Log In",
    register: "Sign Up",
    email: "Email",
    password: "Password",
    name: "Name",
    logout: "Log Out",
    account: "Account",
    
    // Home
    greeting: "Hi, {{name}}",
    appName: "Pashabook",
    subtitle: "AI Storybook Creator",
    yourLibrary: "Your Library ({{count}})",
    noStorybooksYet: "No storybooks yet",
    noStorybooksDescription: "Upload your child's drawing and watch it transform into an animated storybook",
    createFirstStorybook: "Create Your First Storybook",
    
    // Create
    createStorybook: "Create Storybook",
    uploadDrawing: "Upload Drawing",
    selectLanguage: "Select Language",
    japanese: "Japanese",
    english: "English",
    processing: "Processing...",
    
    // Processing stages
    analyzing: "Analyzing drawing...",
    generating: "Generating story...",
    illustrating: "Creating illustrations...",
    animating: "Animating pages...",
    narrating: "Adding narration...",
    composing: "Composing video...",
    
    // Preview
    preview: "Preview",
    saveToLibrary: "Save to Library",
    download: "Download",
    editTitle: "Edit Title",
    deletionReminder: "Videos are automatically deleted after 24 hours. Save to your library to keep them.",
    
    // Library
    library: "Library",
    deleteStorybook: "Delete Storybook",
    deleteConfirmation: "Are you sure you want to delete this storybook? This action cannot be undone.",
    cancel: "Cancel",
    delete: "Delete",
    
    // Status
    pending: "Pending",
    complete: "Complete",
    error: "Error",
    done: "Done",
    
    // Errors
    uploadError: "Failed to upload drawing",
    processingError: "Failed to process storybook",
    networkError: "Network error. Please try again.",
    retry: "Retry",
    
    // Common
    loading: "Loading...",
    back: "Back",
    share: "Share",
    createdOn: "Created on {{date}}",
    savedLocally: "This storybook is saved locally on your device and can be played anytime.",
  },
  ja: {
    // Auth
    login: "ログイン",
    register: "新規登録",
    email: "メールアドレス",
    password: "パスワード",
    name: "名前",
    logout: "ログアウト",
    account: "アカウント",
    
    // Home
    greeting: "こんにちは、{{name}}さん",
    appName: "パシャブック",
    subtitle: "AI絵本クリエイター",
    yourLibrary: "ライブラリ ({{count}}冊)",
    noStorybooksYet: "まだ絵本がありません",
    noStorybooksDescription: "お子様の絵をアップロードして、アニメーション絵本に変身させましょう",
    createFirstStorybook: "最初の絵本を作る",
    
    // Create
    createStorybook: "絵本を作る",
    uploadDrawing: "絵をアップロード",
    selectLanguage: "言語を選択",
    japanese: "日本語",
    english: "英語",
    processing: "処理中...",
    
    // Processing stages
    analyzing: "絵を分析中...",
    generating: "ストーリーを生成中...",
    illustrating: "イラストを作成中...",
    animating: "ページをアニメーション中...",
    narrating: "ナレーションを追加中...",
    composing: "動画を合成中...",
    
    // Preview
    preview: "プレビュー",
    saveToLibrary: "ライブラリに保存",
    download: "ダウンロード",
    editTitle: "タイトルを編集",
    deletionReminder: "動画は24時間後に自動削除されます。保存するにはライブラリに追加してください。",
    
    // Library
    library: "ライブラリ",
    deleteStorybook: "絵本を削除",
    deleteConfirmation: "この絵本を削除してもよろしいですか？この操作は取り消せません。",
    cancel: "キャンセル",
    delete: "削除",
    
    // Status
    pending: "待機中",
    complete: "完了",
    error: "エラー",
    done: "完了",
    
    // Errors
    uploadError: "絵のアップロードに失敗しました",
    processingError: "絵本の処理に失敗しました",
    networkError: "ネットワークエラーが発生しました。もう一度お試しください。",
    retry: "再試行",
    
    // Common
    loading: "読み込み中...",
    back: "戻る",
    share: "共有",
    createdOn: "作成日: {{date}}",
    savedLocally: "この絵本はデバイスにローカル保存されており、いつでも再生できます。",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Language = keyof typeof translations;

// Simple interpolation function
export function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ""));
}
