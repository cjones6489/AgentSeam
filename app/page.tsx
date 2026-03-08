const checklist = [
  "Scaffold the Next.js app shell",
  "Persist actions with Drizzle",
  "Validate requests at the API boundary",
  "Enforce explicit action state transitions",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          AgentSeam
        </p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            Core backend scaffold in progress.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            This app is being built around a single goal: turn risky agent
            actions into explicit approval records with clear state changes.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-950">Current build scope</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
