import { UserForm } from "./components/UserForm.js";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-8">Autopilot - Web App</h1>

        <UserForm />

        <div className="mt-8 p-4 bg-gray-50 rounded-md">
          <h2 className="font-semibold mb-2">Shared Package Demo</h2>
          <p className="text-sm text-gray-600">
            This form uses Zod schemas from <code>@repo/shared</code> for
            validation.
          </p>
        </div>
      </div>
    </main>
  );
}
