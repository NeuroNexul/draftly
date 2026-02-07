import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 selection:bg-neutral-100 selection:text-neutral-950">
      <div className="flex flex-col items-center gap-12">
        {/* Logo */}
        <h1 className="text-5xl tracking-tight font-light lowercase">draftly</h1>

        {/* Tagline */}
        <p className="text-neutral-500 text-sm tracking-widest uppercase">markdown · editor · preview</p>

        {/* CTA */}
        <Link
          href="/playground"
          className="group relative px-8 py-3 text-sm tracking-wide uppercase text-neutral-400 border border-neutral-800 hover:border-neutral-600 hover:text-neutral-100 transition-all duration-300"
        >
          <span className="relative z-10">enter playground</span>
          <span className="absolute inset-0 bg-neutral-100 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left opacity-5" />
        </Link>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 text-neutral-700 text-xs tracking-wider">open source</footer>
    </main>
  );
}
