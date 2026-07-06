export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-soft-beige">
      <main className="flex flex-col items-center gap-8 px-4 text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-lunar-green">Malta Food Experience</h1>
        <p className="text-lg text-lunar-green/70 max-w-md">
          Authentic Maltese culinary and cultural experiences hosted by the Malta Food Agency.
        </p>
        <p className="text-sm text-lunar-green/50">
          Phase 0.2 scaffold — admin panel at{" "}
          <a href="/admin" className="underline text-terracotta hover:text-terracotta/80">
            /admin
          </a>
        </p>
      </main>
    </div>
  )
}
