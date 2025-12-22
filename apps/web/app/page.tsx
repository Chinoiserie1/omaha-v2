"use client";

import { useState } from "react";
import { createUserSchema, type CreateUserDto } from "@repo/shared";

export default function Home() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = createUserSchema.safeParse({ email, name: name || undefined });

    if (!validation.success) {
      setResult(`Validation Error: ${validation.error.errors.map((e) => e.message).join(", ")}`);
      return;
    }

    const data: CreateUserDto = validation.data;
    setResult(`Valid user data: ${JSON.stringify(data, null, 2)}`);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-8">Autopilot - Web App</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="John Doe"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Validate with Zod
          </button>
        </form>

        {result && (
          <pre className="mt-4 p-4 bg-gray-100 rounded-md overflow-auto text-sm">
            {result}
          </pre>
        )}

        <div className="mt-8 p-4 bg-gray-50 rounded-md">
          <h2 className="font-semibold mb-2">Shared Package Demo</h2>
          <p className="text-sm text-gray-600">
            This form uses Zod schemas from <code>@repo/shared</code> for validation.
          </p>
        </div>
      </div>
    </main>
  );
}
