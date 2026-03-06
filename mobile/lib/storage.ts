import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoryPage {
  id: string;
  pageNumber: number;
  narrationText: string;
  imagePrompt: string;
  animationMode: "standard" | "highlight";
  illustrationUrl?: string;
  animationUrl?: string;
  narrationUrl?: string;
}

export interface Storybook {
  id: string;
  title: string;
  drawingUri: string;
  language: "ja" | "en";
  status: "pending" | "processing" | "done" | "error";
  currentStep: string;
  progress: number;
  errorMessage?: string;
  pages: StoryPage[];
  videoUrl?: string;
  createdAt: number;
  updatedAt: number;
}

const STORYBOOKS_KEY = "@pashabook_storybooks";

export async function getStorybooks(): Promise<Storybook[]> {
  const data = await AsyncStorage.getItem(STORYBOOKS_KEY);
  if (!data) return [];
  const books: Storybook[] = JSON.parse(data);
  return books.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStorybook(id: string): Promise<Storybook | null> {
  const books = await getStorybooks();
  return books.find((b) => b.id === id) || null;
}

export async function saveStorybook(book: Storybook): Promise<void> {
  const books = await getStorybooks();
  const index = books.findIndex((b) => b.id === book.id);
  if (index >= 0) {
    books[index] = book;
  } else {
    books.push(book);
  }
  await AsyncStorage.setItem(STORYBOOKS_KEY, JSON.stringify(books));
}

export async function deleteStorybook(id: string): Promise<void> {
  const books = await getStorybooks();
  const filtered = books.filter((b) => b.id !== id);
  await AsyncStorage.setItem(STORYBOOKS_KEY, JSON.stringify(filtered));
}

export function createStorybook(
  drawingUri: string,
  language: "ja" | "en"
): Storybook {
  const id =
    Date.now().toString() + Math.random().toString(36).substr(2, 9);
  return {
    id,
    title: "",
    drawingUri,
    language,
    status: "pending",
    currentStep: "uploading",
    progress: 0,
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
