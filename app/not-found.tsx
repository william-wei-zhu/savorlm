import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="menu grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <Image src="/savvy/think.webp" alt="" width={240} height={240} className="mx-auto w-48" />
        <h1 className="mt-4 text-[2rem]">Savvy can&apos;t find that page</h1>
        <p className="mt-2 text-ink-2">The link may be mistyped, or a shared list may have expired (lists last 180 days).</p>
        <Link href="/" className="btn btn-primary mt-6">
          Pick a city
        </Link>
      </div>
    </main>
  );
}
