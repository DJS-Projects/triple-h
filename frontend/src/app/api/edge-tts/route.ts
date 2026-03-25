import { NextRequest, NextResponse } from 'next/server';

// Backend URL for Edge TTS service (Python FastAPI)
const EDGE_TTS_BACKEND_URL = process.env.EDGE_TTS_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      text,
      voice = "en-US-AriaNeural",
      rate = 0,
      volume = 1.0,
      pitch,
      style,
      use_ssml = false
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required for TTS generation' },
        { status: 400 }
      );
    }

    console.log('🔊 Generating Edge TTS audio...');
    console.log('Voice:', voice);
    console.log('Text length:', text.length, 'characters');

    // Call Python FastAPI backend for Edge TTS
    const response = await fetch(`${EDGE_TTS_BACKEND_URL}/generate-edge-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice,
        rate,
        volume,
        pitch,
        style,
        use_ssml
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Edge TTS backend error:', errorData);
      
      return NextResponse.json(
        { error: errorData.error || errorData.detail || 'Failed to generate TTS audio' },
        { status: response.status }
      );
    }

    // Check if response is audio blob or JSON with filename
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.startsWith('audio/')) {
      // Return audio blob directly
      const audioBuffer = await response.arrayBuffer();
      const audioFilename = response.headers.get('x-audio-filename') || 'tts_audio.mp3';
      
      console.log('✅ Edge TTS generation successful');
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': contentType,
          'X-Audio-Filename': audioFilename,
        },
      });
    } else {
      // Return JSON response with filename
      const result = await response.json();
      console.log('✅ Edge TTS generation successful');
      return NextResponse.json(result);
    }
    
  } catch (error) {
    console.error('Error in Edge TTS API route:', error);
    return NextResponse.json(
      { error: `TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
