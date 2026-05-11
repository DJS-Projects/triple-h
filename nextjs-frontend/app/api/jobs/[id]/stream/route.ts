import { type NextRequest, NextResponse } from "next/server";

// Streaming SSE proxy from the FastAPI backend's /jobs/{id}/stream endpoint.
// Browser can't hit the backend directly because API_BASE_URL is server-only
// (no NEXT_PUBLIC prefix) — Next.js relays the byte stream as-is so the
// client just opens an EventSource against /api/jobs/{id}/stream.
//
// Implementation notes:
//   - `dynamic = "force-dynamic"` disables route caching; SSE is per-request.
//   - We pass the upstream Response body straight through. Node-side
//     streaming preserves chunk timing so the FE sees events as fast as
//     the backend's 500ms poll cadence allows.
//   - Cache-Control and Connection headers are set explicitly to keep
//     intermediate proxies (and Next's own response handling) from
//     buffering the stream into one big chunk.

export const dynamic = "force-dynamic";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const baseURL = process.env.API_BASE_URL;
	if (!baseURL) {
		return NextResponse.json(
			{ error: "API_BASE_URL unset" },
			{ status: 500 },
		);
	}

	const upstream = await fetch(
		`${baseURL}/jobs/${encodeURIComponent(id)}/stream`,
		{
			cache: "no-store",
			// Forward the abort signal so killing the client connection
			// (browser navigates away, tab closes) tears down the backend
			// poll loop instead of leaving it spinning until timeout.
			signal: req.signal,
		},
	);

	if (!upstream.ok || !upstream.body) {
		return NextResponse.json(
			{ error: `upstream ${upstream.status}` },
			{ status: upstream.status },
		);
	}

	return new NextResponse(upstream.body, {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			// Disable nginx/proxy buffering if anyone sits in front.
			"X-Accel-Buffering": "no",
		},
	});
}
