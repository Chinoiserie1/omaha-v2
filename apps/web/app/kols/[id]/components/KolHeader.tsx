import type { KolItem } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export function KolHeader({ kol }: { kol: KolItem }) {
  const name = kol.displayName ?? kol.username;

  return (
    <div className="flex items-start gap-4">
      {kol.avatarUrl ? (
        <img
          src={kol.avatarUrl}
          alt={name}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()}
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{name}</h1>
          {kol.isActive ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              Inactive
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500">@{kol.username}</p>
        {kol.bio && <p className="mt-1 max-w-xl text-sm text-zinc-600">{kol.bio}</p>}
        <div className="mt-2 flex gap-4 text-sm text-zinc-600">
          <span>{formatNumber(kol.followersCount)} followers</span>
          <span>{formatNumber(kol.tweetCount)} tweets</span>
        </div>
      </div>
    </div>
  );
}
