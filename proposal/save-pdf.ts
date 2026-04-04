import { chromium } from "playwright";
import { resolve } from "path";

const inputPath = resolve(import.meta.dir, "heng-hup-pricing.html");
const outputPath = resolve(import.meta.dir, "heng-hup-pricing.pdf");

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(`file://${inputPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Hide all reveal.js UI chrome (controls, progress, slide number)
await page.evaluate(() => {
	const hide = (sel: string) => {
		const el = document.querySelector(sel) as HTMLElement | null;
		if (el) el.style.display = "none";
	};
	hide(".reveal .controls");
	hide(".reveal .progress");
	hide(".reveal .slide-number");
});

const totalSlides = await page.evaluate(() => {
	return (window as any).Reveal.getTotalSlides();
});

console.log(`Capturing ${totalSlides} slides...`);

const screenshots: Buffer[] = [];

for (let i = 0; i < totalSlides; i++) {
	await page.evaluate((idx: number) => {
		(window as any).Reveal.slide(idx);
	}, i);
	await page.waitForTimeout(400);

	// Screenshot just the current slide element, not the full page
	const slideEl = await page.$(".reveal .slides section.present");
	if (slideEl) {
		const shot = await slideEl.screenshot({ type: "png" });
		screenshots.push(shot);
	} else {
		// Fallback to full viewport
		const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1280, height: 720 } });
		screenshots.push(shot);
	}
	console.log(`  Slide ${i + 1}/${totalSlides} captured`);
}

await browser.close();

// Build PDF from screenshots via a wrapper HTML page
const slideHtml = screenshots
	.map((buf, i) => {
		const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
		const pageBreak = i < screenshots.length - 1 ? "page-break-after: always;" : "";
		return `<div style="width: 1280px; height: 720px; overflow: hidden; ${pageBreak}"><img src="${dataUri}" style="width: 1280px; height: 720px; display: block; object-fit: cover;" /></div>`;
	})
	.join("\n");

const wrapperHtml = `<!DOCTYPE html>
<html><head><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: 1280px 720px; margin: 0; }
html, body { width: 1280px; margin: 0; padding: 0; }
</style></head><body>${slideHtml}</body></html>`;

const browser2 = await chromium.launch();
const page2 = await browser2.newPage();
await page2.setContent(wrapperHtml, { waitUntil: "networkidle" });

await page2.pdf({
	path: outputPath,
	width: "1280px",
	height: "720px",
	printBackground: true,
	margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser2.close();
console.log(`\nSaved to ${outputPath}`);
