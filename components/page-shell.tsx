import Image from "next/image";
import Link from "next/link";
import { NAME, TAGLINE } from "@/lib/brand";

// Subpages share the home page's language (standard §4): the espresso menu
// header, gold ornament, and content in cards.
export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="menu">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label={`${NAME} home`}>
            <span className="rounded-full border-2 border-gold p-1">
              <Image src="/savvy/avatar.webp" alt="" width={56} height={56} className="size-12 rounded-full bg-[#2a211d]" />
            </span>
            <span>
              <span className="block font-display text-[1.7rem] font-extrabold leading-none">{NAME}</span>
              <span className="mt-1 block text-[0.9rem] text-gold-text">{TAGLINE}</span>
            </span>
          </Link>
          <Link href="/" className="btn ml-auto border-2 border-gold text-ink hover:bg-sunk">
            Back to Savvy
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-5 py-8">
        <h1 className="text-[2.2rem]">{title}</h1>
        {children}
      </main>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-1 px-5 pb-10 text-[0.95rem]">
        <a href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Built by William Zhu
        </a>
        <Link href="/about" className="underline underline-offset-2">
          About
        </Link>
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
        <Link href="/settings" className="underline underline-offset-2">
          Settings
        </Link>
      </footer>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-line bg-surface p-5 shadow-[var(--shadow)]">
      <h2 className="text-[1.35rem]">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
