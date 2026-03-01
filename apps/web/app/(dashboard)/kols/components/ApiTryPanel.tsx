"use client";

import { useState } from "react";

const API_BASE =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4001";

interface Endpoint {
  label: string;
  path: string;
}

function getEndpoints(kolId: string): Endpoint[] {
  return [
    { label: "Try: Tweets", path: `/api/kols/${kolId}/tweets?limit=5` },
    { label: "Try: Significant", path: `/api/kols/${kolId}/tweets/significant?limit=5` },
    { label: "Try: Thesis", path: `/api/kols/${kolId}/portfolio` },
  ];
}

export function ApiTryPanel({ kolId }: { kolId: string }) {
  const [open, setOpen] = useState<Endpoint | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick(endpoint: Endpoint) {
    setOpen(endpoint);
    setData(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}${endpoint.path}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}: ${res.statusText}`);
      } else {
        setData(await res.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
        {getEndpoints(kolId).map((ep) => (
          <button
            key={ep.label}
            onClick={() => handleClick(ep)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {ep.label}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(null)}
        >
          <div
            className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                GET {open.path}
              </h3>
              <button
                onClick={() => setOpen(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                &times;
              </button>
            </div>

            <div className="border-b border-zinc-100 px-4 py-2">
              <code className="select-all break-all text-xs text-zinc-500">
                {API_BASE}{open.path}
              </code>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <p className="text-sm text-zinc-500">Loading...</p>
              )}
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              {data !== null && (
                <pre className="whitespace-pre-wrap break-words text-xs text-zinc-800">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
