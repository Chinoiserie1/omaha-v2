import OmahaLogo from "./components/OmahaLogo";
import WaitlistForm from "./components/WaitlistForm";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] bg-cover bg-center px-4 text-white" style={{ backgroundImage: "url('/hero-bg.jpg')" }}>

      {/* Header */}
      <header className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <OmahaLogo className="h-7 w-7 text-blue-400" />
            <span className="text-lg font-bold">Omaha</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        <span className="mb-6 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-400">
          NOW IN PRIVATE ALPHA
        </span>

        <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl">
          Invest like the{" "}
          <span className="text-blue-400">Top 0.1%</span>
        </h1>

        <p className="mb-8 max-w-lg text-lg text-zinc-400">
          Track the best investors, instant notif of their alpha, seamless
          exposure.
        </p>

        <WaitlistForm />

        <p className="mt-6 text-sm text-zinc-500">
          Join other investors securing early access.
        </p>
      </div>
    </main>
  );
}
