import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
	return (
		<header className="border-b border-rule-soft bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
			<div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-6">
				<Link
					href="/"
					className="flex items-center gap-3 transition-opacity hover:opacity-80"
					aria-label="Heng Hup Holdings — home"
				>
					<Image
						src="/brand/henghup-logo.png"
						alt="Heng Hup Holdings Limited"
						width={2071}
						height={397}
						priority
						className="h-9 w-auto"
					/>
				</Link>

				<nav className="ml-auto flex items-center gap-1 font-mono text-xs uppercase tracking-[0.14em]">
					<NavLink href="/">Upload</NavLink>
					<NavLink href="/documents">Documents</NavLink>
				</nav>
			</div>
		</header>
	);
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Link
			href={href}
			className="rounded-sm px-3 py-2 text-ink-mute transition-colors hover:bg-muted hover:text-brand-navy"
		>
			{children}
		</Link>
	);
}
