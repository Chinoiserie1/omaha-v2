import { fetchKols } from "@/lib/api";
import { QuantCard } from "./components/QuantCard";

export const dynamic = "force-dynamic";

export default async function KolsPage() {
  let kols;
  try {
    kols = await fetchKols();
  } catch {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold">KOL Dashboard</h1>
        <p className="text-zinc-500">
          Unable to connect to the API. Make sure the backend is running on port
          3001.
        </p>
      </main>
    );
  }

  if (kols.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold">KOL Dashboard</h1>
        <p className="text-zinc-500">No KOLs found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">KOL Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kols.map((kol) => (
          <QuantCard key={kol.id} kol={kol} />
        ))}
      </div>
    </main>
  );
}
