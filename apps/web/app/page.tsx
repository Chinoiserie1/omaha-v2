import OmahaLogo from "./components/OmahaLogo";
import WaitlistForm from "./components/WaitlistForm";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] px-4 text-white">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <OmahaLogo className="h-7 w-7 text-blue-400" />
            <span className="text-lg font-bold">Omaha</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#roadmap" className="transition hover:text-white">
              Roadmap
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        <span className="mb-6 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-400">
          NOW IN PRIVATE ALPHA
        </span>

        <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl">
          Invest on the Signals of the{" "}
          <span className="text-blue-400">Top 1%</span>
        </h1>

        <p className="mb-8 max-w-lg text-lg text-zinc-400">
          Track the most influential crypto voices, decode their alpha, and act
          before the crowd.
        </p>

        <WaitlistForm />

        <p className="mt-6 text-sm text-zinc-500">
          Join other investors securing early access.
        </p>
      </div>
    </main>
  );
}
