import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center p-8">
      <h1 className="mb-4 text-3xl font-bold">Autopilot</h1>
      <p className="mb-6 text-zinc-600">KOL tracking and portfolio analytics</p>
      <Link
        href="/kols"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        View Dashboard
      </Link>
    </main>
  );
}
