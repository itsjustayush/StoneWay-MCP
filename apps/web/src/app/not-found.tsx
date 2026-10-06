import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 font-mono">
      <h1 className="text-4xl font-bold text-white tracking-widest">404</h1>
      <p className="text-neutral-400 text-xs">
        [StoneWay Memory Error]: The requested coordinate does not exist.
      </p>
      <Link
        href="/"
        className="text-xs text-neutral-300 border border-neutral-800 px-4 py-2 rounded hover:border-neutral-600 hover:text-white transition"
      >
        ← return home
      </Link>
    </div>
  );
}
