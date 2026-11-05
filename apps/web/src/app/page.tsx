import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-finhand-border bg-white p-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-14">
        <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-finhand-interactive uppercase">
          FinHand
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-finhand-primary sm:text-6xl">
          Your financial life, easier to understand.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-finhand-muted">
          Sign in securely with Google to start organizing your accounts,
          transactions, and financial plans.
        </p>
        <GoogleSignInButton />
      </section>
    </main>
  );
}
