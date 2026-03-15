import { Storybook, saveStorybook } from "./storage";

const STEPS = [
  { step: "analyzing", label: "Analyzing drawing...", progress: 15 },
  { step: "generating_story", label: "Creating story...", progress: 30 },
  { step: "generating_illustrations", label: "Generating illustrations...", progress: 50 },
  { step: "generating_narration", label: "Creating narration...", progress: 65 },
  { step: "generating_animation", label: "Animating pages...", progress: 80 },
  { step: "compositing", label: "Compositing video...", progress: 95 },
  { step: "done", label: "Complete!", progress: 100 },
];

const SAMPLE_TITLES_JA = [
  "おひさまとうさぎさん",
  "まほうのもりのぼうけん",
  "そらをとぶねこ",
  "にじいろのおはな",
  "ちいさなゆうしゃ",
];

const SAMPLE_TITLES_EN = [
  "The Sunny Rabbit",
  "Adventure in the Magic Forest",
  "The Flying Cat",
  "Rainbow Flowers",
  "The Little Hero",
];

const SAMPLE_NARRATIONS_JA = [
  "むかしむかし、あるところに、小さなうさぎが住んでいました。うさぎさんは毎朝、おひさまにあいさつをしていました。",
  "ある日、うさぎさんは森の奥で、きらきら光る不思議な花を見つけました。「わあ、きれい！」うさぎさんは目を輝かせました。",
  "花に近づくと、花はふわりと浮き上がり、虹色の光を放ちました。「ついてきて」と花がささやきました。",
  "うさぎさんは花について、空高く飛びました。雲の上には、美しい虹の橋がかかっていました。",
  "虹の橋の向こうには、たくさんの動物たちが待っていました。「ようこそ！」みんなが笑顔で迎えてくれました。",
  "うさぎさんは新しい友達と一緒に、星空の下で踊りました。「また来てね」とみんなが言いました。おしまい。",
];

const SAMPLE_NARRATIONS_EN = [
  "Once upon a time, there lived a little rabbit who greeted the sun every morning with a cheerful smile.",
  "One day, the rabbit found a sparkling, mysterious flower deep in the forest. 'How beautiful!' the rabbit exclaimed with shining eyes.",
  "As the rabbit approached, the flower floated up and glowed with rainbow light. 'Follow me,' whispered the flower.",
  "The rabbit followed the flower high into the sky. Above the clouds, a beautiful rainbow bridge stretched across the horizon.",
  "Beyond the rainbow bridge, many animals were waiting. 'Welcome!' they all greeted with warm smiles.",
  "The rabbit danced under the starry sky with new friends. 'Come back again!' everyone said. The end.",
];

export async function simulateGeneration(
  book: Storybook,
  onUpdate: (book: Storybook) => void
): Promise<Storybook> {
  let current: Storybook = { ...book, status: "processing" };

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

    current = {
      ...current,
      currentStep: step.step,
      progress: step.progress,
      updatedAt: Date.now(),
    };

    if (step.step === "generating_story") {
      const titles = current.language === "ja" ? SAMPLE_TITLES_JA : SAMPLE_TITLES_EN;
      const narrations = current.language === "ja" ? SAMPLE_NARRATIONS_JA : SAMPLE_NARRATIONS_EN;
      current.title = titles[Math.floor(Math.random() * titles.length)];
      current.pages = narrations.map((text, idx) => ({
        id: Date.now().toString() + idx,
        pageNumber: idx + 1,
        narrationText: text,
        imagePrompt: `Page ${idx + 1} illustration`,
        animationMode: (idx === 3 || idx === 4 ? "highlight" : "standard") as "standard" | "highlight",
      }));
    }

    if (step.step === "done") {
      current = { ...current, status: "done" };
    }

    await saveStorybook(current);
    onUpdate(current);
  }

  return current;
}
