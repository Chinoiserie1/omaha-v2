import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-white text-zinc-900">
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg font-bold text-zinc-900">
            Omaha
          </Link>
          <Link
            href="/kols"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Dashboard
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
