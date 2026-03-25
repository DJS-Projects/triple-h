import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  // Call Python FastAPI backend
  const response = await fetch("http://127.0.0.1:8000/generate/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 });
  }

  // Return video back to frontend
  const videoBuffer = await response.arrayBuffer();
  return new NextResponse(videoBuffer, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
}
