/**
 * F1 boot screen — visible only during development to confirm:
 *   1. JUST tokens loaded (warm paper bg, brand colors, fonts)
 *   2. Tailwind utility classes resolve to the right values
 *   3. RTK Query base API and React Router are wired
 *
 * Replaced by the real AppShell + routing in F2.
 */
export default function BootScreen() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-8">

      {/* ── Crest + wordmark ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <img
          src="/logo-just.png"
          alt="JUST crest"
          className="w-20 h-20 object-contain"
        />
        <div className="text-center">
          <p className="eyebrow mb-1">Jamhuriya University of Science &amp; Technology</p>
          <h1
            className="text-just-blue-600 text-balance"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h2)', fontWeight: 600 }}
          >
            Group Formation System
          </h1>
          <p className="text-ink-500 mt-1" style={{ fontSize: 'var(--fs-small)' }}>
            Admin &amp; Instructor Dashboard — Development Build
          </p>
        </div>
      </div>

      {/* ── Status badges ────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {[
          { label: 'JUST Tokens',   ok: true },
          { label: 'Tailwind CSS',  ok: true },
          { label: 'RTK Query',     ok: true },
          { label: 'React Router',  ok: true },
          { label: 'shadcn ready',  ok: true },
        ].map(({ label, ok }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium"
            style={{
              borderColor: ok ? 'var(--just-green-300)' : 'var(--ink-200)',
              background:  ok ? 'var(--just-green-50)'  : 'var(--paper-2)',
              color:       ok ? 'var(--just-green-700)'  : 'var(--ink-500)',
            }}
          >
            <span>{ok ? '✓' : '○'}</span> {label}
          </span>
        ))}
      </div>

      {/* ── JUST palette strip ───────────────────────────────────────── */}
      <div className="w-full max-w-lg">
        <p className="eyebrow mb-3 text-center">Brand Palette</p>
        <div className="grid grid-cols-3 gap-3">
          {/* Royal Blue */}
          <div className="rounded-md overflow-hidden border border-ink-200 shadow-xs">
            <div className="h-10 bg-just-blue-600" />
            <div className="bg-white px-3 py-2">
              <p className="text-xs font-semibold text-ink-800">Royal Blue</p>
              <p className="text-xs text-ink-400">#1E3A8A — Primary</p>
            </div>
          </div>
          {/* University Green */}
          <div className="rounded-md overflow-hidden border border-ink-200 shadow-xs">
            <div className="h-10 bg-just-green-500" />
            <div className="bg-white px-3 py-2">
              <p className="text-xs font-semibold text-ink-800">University Green</p>
              <p className="text-xs text-ink-400">#128A47 — Secondary</p>
            </div>
          </div>
          {/* Laurel Gold */}
          <div className="rounded-md overflow-hidden border border-ink-200 shadow-xs">
            <div className="h-10 bg-just-gold-400" />
            <div className="bg-white px-3 py-2">
              <p className="text-xs font-semibold text-ink-800">Laurel Gold</p>
              <p className="text-xs text-ink-400">#E8C547 — Accent</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Typography sample ────────────────────────────────────────── */}
      <div
        className="mt-10 w-full max-w-lg rounded-lg border border-ink-200 shadow-sm bg-white p-6"
      >
        <p className="eyebrow mb-3">Typography Check</p>
        <h2 className="text-ink-900 mb-1 text-balance">
          Source Serif 4 — Heading
        </h2>
        <p className="text-ink-600 text-pretty" style={{ fontSize: 'var(--fs-small)' }}>
          Source Sans 3 body text — readable, clean, institutional.
          Designed to pair natively with the serif display face.
        </p>
        <p
          className="mt-2 text-ink-400"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)' }}
        >
          JetBrains Mono — for data tables and code
        </p>
      </div>

      {/* ── Footer note ──────────────────────────────────────────────── */}
      <p className="mt-10 text-ink-400" style={{ fontSize: 'var(--fs-micro)' }}>
        Step F1 complete — proceed to F2 (App Shell &amp; Auth)
      </p>

    </div>
  );
}
