export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-emerald-950/10 bg-white p-10 shadow-[0_24px_80px_rgba(20,34,26,0.08)] sm:p-14">
        <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-emerald-700 uppercase">
          FinHand
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-emerald-950 sm:text-6xl">
          Your financial life, easier to understand.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          Project foundation is ready. Accounts, transactions, document
          processing, and AI guidance will arrive in the next milestones.
        </p>
        <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]"
          />
          Frontend running successfully
        </div>
      </section>
    </main>
  );
}
