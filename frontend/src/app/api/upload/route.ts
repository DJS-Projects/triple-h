import { type NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.DOC_EXTRACTOR_URL ?? "http://localhost:8002";

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();

		const response = await fetch(`${BACKEND_URL}/upload_pdf`, {
			method: "POST",
			body: formData,
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.ok ? 200 : 502 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to reach backend";
		return NextResponse.json(
			{ status: "error", message: `Backend unavailable: ${message}` },
			{ status: 502 },
		);
	}
}
