import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="doodle-card p-8 max-w-xl text-center">
        <h1
          style={{
            fontFamily: "var(--font-caveat), cursive",
            fontWeight: 700,
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          DoodleBooth
        </h1>
        <p className="font-courier mb-2">
          A Claude-powered pixel-art photobooth.
        </p>
        <p className="font-courier mb-6 opacity-80">
          Take 4 quick shots → get 4 hand-drawn 8-bit stickers.
        </p>
        <Link href="/booth" className="doodle-btn-primary inline-block">
          Open the booth
        </Link>
        <p className="font-courier text-xs mt-6 opacity-70">
          🔒 Your photos never leave your device.
        </p>
      </div>
    </main>
  );
}
