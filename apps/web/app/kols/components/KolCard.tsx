import Link from "next/link";
import type { KolItem } from "@/lib/api";
import { formatNumber } from "@/lib/format";

function Initials({ name }: { name: string | null }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
      {initials}
    </div>
  );
}

export function KolCard({ kol }: { kol: KolItem }) {
  const name = kol.displayName ?? kol.username;

  return (
    <Link
      href={`/kols/${kol.id}`}
      className="block rounded-lg border border-zinc-200 p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        {kol.avatarUrl ? (
          <img
            src={kol.avatarUrl}
            alt={name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <Initials name={name} />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900">
            {name}
          </p>
          <p className="text-sm text-zinc-500">@{kol.username}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-zinc-600">
        <span>{formatNumber(kol.followersCount)} followers</span>
        <span>{formatNumber(kol.tweetCount)} tweets</span>
      </div>

      {!kol.isActive && (
        <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          Inactive
        </span>
      )}
    </Link>
  );
}
