import { loginAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Admin Login</h1>
      <form action={loginAction} className="flex flex-col gap-4">
        {error === "ratelimited" ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Too many attempts. Try again in a few minutes.
          </p>
        ) : (
          error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Incorrect password.
            </p>
          )
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
