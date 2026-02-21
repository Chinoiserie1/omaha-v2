"use client";

import { useState } from "react";
import { createUserSchema, type CreateUserDto } from "@repo/shared";
import { ValidationResult } from "./ValidationResult";

export function UserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = createUserSchema.safeParse({
      email,
      name: name || undefined,
    });

    if (!validation.success) {
      setResult(
        `Validation Error: ${validation.error.errors.map((e) => e.message).join(", ")}`
      );
      return;
    }

    const data: CreateUserDto = validation.data;
    setResult(`Valid user data: ${JSON.stringify(data, null, 2)}`);
  };

  return (
    <>
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
          className="w-full bg-zinc-900 text-white py-2 px-4 rounded-md hover:bg-zinc-800"
        >
          Validate with Zod
        </button>
      </form>

      <ValidationResult result={result} />
    </>
  );
}
