import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface JobPosition {
  title: string;
  description: string;
  requirements: string[];
  level: "entry" | "mid" | "senior";
  industry: string;
}

export async function POST(req: Request) {
  let requestData: any;

  try {
    requestData = await req.json();
    const { jobPosition, interviewType, answers } = requestData;

    console.log("Server: Generating simplified interview feedback...");
    console.log("Answers received:", answers.length);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    const feedbackPrompt = createFeedbackPrompt(jobPosition, interviewType, answers);

    const result = await model.generateContent(feedbackPrompt);
    const feedbackText = result.response.text();

    console.log("=".repeat(80));
    console.log("Server: FULL Gemini Response:");
    console.log(feedbackText);
    console.log("=".repeat(80));

    // Clean and parse the response
    let feedbackJson;
    try {
      // Strip markdown code fences and extra whitespace
      let cleanedText = feedbackText.trim();
      
      // Remove ```json ... ``` or ``` ... ``` wrappers
      const codeBlockMatch = cleanedText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
      if (codeBlockMatch) {
        console.log("Server: Detected and removed code block wrapper");
        cleanedText = codeBlockMatch[1].trim();
      }
      
      // Remove leading/trailing quotes if present
      if ((cleanedText.startsWith('"') && cleanedText.endsWith('"')) || 
          (cleanedText.startsWith("'") && cleanedText.endsWith("'"))) {
        console.log("Server: Detected and removed quote wrapper");
        cleanedText = cleanedText.slice(1, -1);
      }

      console.log("Server: Cleaned text (first 300 chars):", cleanedText.substring(0, 300));
      
      feedbackJson = JSON.parse(cleanedText);
      
      console.log("✅ Server: Successfully parsed JSON feedback");
      console.log("Server: Parsed structure:", {
        overall_score: feedbackJson.overall_score,
        overall_length: feedbackJson.overall?.length || 0,
        strengths_count: feedbackJson.strengths?.length || 0,
        improvements_count: feedbackJson.areas_for_improvement?.length || 0
      });
      
      // Ensure overall_score is a number
      if (feedbackJson.overall_score) {
        feedbackJson.overall_score = Number(feedbackJson.overall_score);
        console.log("Server: Parsed overall_score as number:", feedbackJson.overall_score);
      }
      
    } catch (parseError) {
      console.error("❌ Server: JSON parse error:", parseError);
      console.error("Server: Failed to parse text:", feedbackText);
      
      // Fallback: wrap in overall field
      feedbackJson = { 
        overall_score: 75,
        overall: feedbackText,
        strengths: [],
        areas_for_improvement: []
      };
      console.log("Server: Using fallback feedback structure");
    }

    return NextResponse.json({
      feedback: feedbackJson,
      success: true,
      source: "gemini",
    });
  } catch (error) {
    console.error("Server: Feedback generation error:", error);

    const fallbackFeedback = getFallbackFeedback(
      requestData?.interviewType || "general",
      requestData?.answers?.length || 0
    );

    return NextResponse.json({
      feedback: fallbackFeedback,
      success: false,
      source: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * 🧠 Prompt template for concise AI feedback
 */
function createFeedbackPrompt(
  jobPosition: JobPosition,
  interviewType: "general" | "technical" | "behavioral",
  answers: Array<{ question: string; answer: string; timestamp: Date }>
): string {
  const contextInfo = `
Position: ${jobPosition.title}
Industry: ${jobPosition.industry}
Experience Level: ${jobPosition.level}
Interview Type: ${interviewType}
Key Requirements: ${jobPosition.requirements.join(", ")}
`;

  const qaSection = answers
    .map(
      (qa, i) => `
Question ${i + 1}: ${qa.question}
Answer: ${qa.answer || "[No answer provided]"}`
    )
    .join("\n");

  return `
You are an empathetic and professional interview coach giving structured feedback for a ${interviewType} mock interview.

${contextInfo}

Candidate's Responses:
${qaSection}

CRITICAL: Return ONLY a valid JSON object. Do NOT include markdown code fences, explanations, or any text outside the JSON. Each sentence must be under 10 words.

Return this exact JSON structure:

{
  "overall_score": <number between 0-100>,
  "overall": "1-2 sentences summarizing the candidate's performance, tone, and readiness for ${jobPosition.title}. Be encouraging and highlight their potential.",
  "strengths": [
    "Specific strength 1 based on their answers",
    "Specific strength 2 based on their answers",
    "Specific strength 3 based on their answers"
  ],
  "areas_for_improvement": {
  [
    "Specific improvement area 1 with actionable tips",
    "Specific improvement area 2 with actionable tips",
    "Specific improvement area 3 with actionable tips"
  ]
}

Guidelines:
- Be concise, supportive, and specific to their actual answers
- Use a friendly, encouraging tone
- Tailor advice to ${jobPosition.level}-level expectations for ${jobPosition.title}
- Consider neurodivergent-friendly feedback: clear, structured, non-judgmental
- The overall_score should reflect readiness for the role (0-100 scale)
- Include at least 3 items in each array (strengths, areas_for_improvement, recommendations)
- NO markdown formatting, NO code fences, NO extra text - ONLY the JSON object
`;
}

/**
 * 🧩 Fallback JSON if Gemini fails
 */
function getFallbackFeedback(
  interviewType: "general" | "technical" | "behavioral",
  answersCount: number
) {
  return {
    overall_score: 75,
    overall: `You completed a ${interviewType} interview with ${answersCount} questions. Good effort — your answers show strong motivation and willingness to improve.`,
    strengths: [
      "Actively participated throughout the interview.",
      "Clear and confident communication.",
      "Demonstrated self-awareness and enthusiasm.",
    ],
    areas_for_improvement: [
      "Provide more detailed examples when answering - try using the STAR method (Situation, Task, Action, Result) to structure your responses more effectively.",
      "Be more specific with metrics and quantifiable results to strengthen your answers and demonstrate impact.",
      `Add more specific keywords and terminology related to ${interviewType} skills to show deeper domain knowledge.`,
    ],
  };
}
