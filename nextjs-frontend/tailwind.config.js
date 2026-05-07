/** @type {import('tailwindcss').Config} */

/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
	darkMode: ["class"],
	content: [
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "ui-serif", "Georgia"],
				body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
				mono: ["var(--font-mono)", "ui-monospace", "Menlo"],
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) + 2px)",
				sm: "calc(var(--radius) + 1px)",
			},
			colors: {
				/* bento warehouse semantic + Heng Hup brand */
				paper: "hsl(var(--surface-paper))",
				ink: {
					DEFAULT: "hsl(var(--ink))",
					mute: "hsl(var(--ink-mute))",
				},
				rule: {
					DEFAULT: "hsl(var(--rule))",
					soft: "hsl(var(--rule-soft))",
				},
				edit: "hsl(var(--accent-edit))",
				ok: "hsl(var(--accent-ok))",
				warn: "hsl(var(--accent-warn))",
				tag: "hsl(var(--accent-tag))",
				brand: {
					navy: "hsl(var(--brand-navy))",
					blue: "hsl(var(--brand-blue))",
					deep: "hsl(var(--brand-deep))",
					sky: "hsl(var(--brand-sky))",
				},

				/* shadcn compatibility */
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
