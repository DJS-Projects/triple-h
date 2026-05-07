import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string; no: string }> },
) {
	const { id, no } = await params;
	const baseURL = process.env.API_BASE_URL;
	if (!baseURL) {
		return NextResponse.json({ error: "API_BASE_URL unset" }, { status: 500 });
	}

	const upstream = await fetch(
		`${baseURL}/documents/${encodeURIComponent(id)}/pages/${encodeURIComponent(no)}/blocks`,
		{ cache: "no-store" },
	);

	if (!upstream.ok) {
		return NextResponse.json(
			{ error: `upstream ${upstream.status}` },
			{ status: upstream.status },
		);
	}

	const data = await upstream.json();
	return NextResponse.json(data);
}
