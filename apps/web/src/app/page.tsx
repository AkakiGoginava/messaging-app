export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-4 px-8 py-32 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Messaging App
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Application skeleton is running. Product features are implemented
          through subsequent Stage 1 stories.
        </p>
      </main>
    </div>
  );
}
