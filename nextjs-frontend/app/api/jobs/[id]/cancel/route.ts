import { type NextRequest, NextResponse } from "next/server";

// Cancel-job proxy. Mirrors the SSE stream proxy pattern — browser hits
// /api/jobs/{id}/cancel, Next forwards to backend POST /jobs/{id}/cancel.
// Backend is idempotent (double-cancels are no-ops) so the FE doesn't
// have to race-guard the button.

export const dynamic = "force-dynamic";

export async function POST(
	_req: NextRequest,
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
		`${baseURL}/jobs/${encodeURIComponent(id)}/cancel`,
		{ method: "POST", cache: "no-store" },
	);

	const body = await upstream.text();
	return new NextResponse(body, {
		status: upstream.status,
		headers: { "Content-Type": "application/json" },
	});
}
