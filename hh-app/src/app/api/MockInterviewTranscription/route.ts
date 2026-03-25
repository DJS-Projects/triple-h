import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log('🎤 Server: Starting transcription...');
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Server: OPENAI_API_KEY not found in environment variables');
      return NextResponse.json({ 
        text: "", 
        error: "OpenAI API key not configured" 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    
    if (!file) {
      console.error('❌ Server: No audio file received');
      return NextResponse.json({ 
        text: "", 
        error: "No audio file provided" 
      }, { status: 400 });
    }

    console.log('📊 Server: Audio file size:', file.size, 'bytes');
    console.log('📊 Server: Audio file type:', file.type);

    // Create FormData for OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append("file", file, "recording.webm");
    openaiFormData.append("model", "whisper-1");
    openaiFormData.append("language", "en");

    console.log('🔗 Server: Calling OpenAI Whisper API...');
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    console.log('📨 Server: OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server: OpenAI API error:', response.status, errorText);
      return NextResponse.json({ 
        text: "", 
        error: `OpenAI API error: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Server: Transcription successful');
    console.log('📝 Server: Transcribed text:', data.text?.substring(0, 100) + '...');

    return NextResponse.json({ 
      text: data.text || "",
      success: true 
    });
  } catch (error) {
    console.error("❌ Server: Transcription error:", error);
    return NextResponse.json({ 
      text: "", 
      error: error instanceof Error ? error.message : "Unknown error",
      success: false 
    }, { status: 500 });
  }
}
