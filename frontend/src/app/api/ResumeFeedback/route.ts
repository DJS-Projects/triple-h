import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Forward the file to the Python FastAPI backend
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await fetch("http://localhost:8000/resume-feedback", {
      method: "POST",
      body: backendFormData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || "Failed to process resume" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Parse the feedback if it's a string
    let feedbackData;
    if (typeof data.feedback === "string") {
      try {
        // Remove markdown code fences if present
        let cleanedFeedback = data.feedback.trim();
        const codeBlockMatch = cleanedFeedback.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
        if (codeBlockMatch) {
          cleanedFeedback = codeBlockMatch[1].trim();
        }
        feedbackData = JSON.parse(cleanedFeedback);
      } catch (parseError) {
        console.error("Failed to parse feedback JSON:", parseError);
        feedbackData = { error: "Failed to parse AI response", raw: data.feedback };
      }
    } else {
      feedbackData = data.feedback;
    }

    return NextResponse.json({
      filename: data.filename,
      feedback: feedbackData,
      success: true,
    });
  } catch (error) {
    console.error("Resume feedback error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false 
      },
      { status: 500 }
    );
  }
}
