import { NextRequest, NextResponse } from 'next/server';

const WAV2LIP_BACKEND_URL = process.env.WAV2LIP_BACKEND_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract text and avatar information
    const { text, avatarUrl, language = 'en' } = body;
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required for lip-sync generation' },
        { status: 400 }
      );
    }

    if (!avatarUrl) {
      return NextResponse.json(
        { error: 'Avatar URL is required for lip-sync generation' },
        { status: 400 }
      );
    }

    console.log('🎬 Requesting lip-sync generation...');
    console.log('Text:', text.substring(0, 100) + '...');
    console.log('Avatar URL:', avatarUrl);
    
    // Make request to Wav2Lip backend
    const response = await fetch(`${WAV2LIP_BACKEND_URL}/generate-lip-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        avatar_url: avatarUrl,
        language,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Wav2Lip backend error:', errorData);
      
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate lip-sync video' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Convert backend URL to frontend-accessible URL
    if (result.video_url) {
      result.video_url = `${WAV2LIP_BACKEND_URL}${result.video_url}`;
    }

    console.log('✅ Lip-sync generation successful');
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in wav2lip API route:', error);
    
    return NextResponse.json(
      { error: 'Internal server error during lip-sync generation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check for the Wav2Lip backend
    const response = await fetch(`${WAV2LIP_BACKEND_URL}/health`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Wav2Lip backend is not available' },
        { status: 503 }
      );
    }

    const health = await response.json();
    
    return NextResponse.json({
      status: 'healthy',
      backend: health,
      backend_url: WAV2LIP_BACKEND_URL,
    });
    
  } catch (error) {
    console.error('Error checking Wav2Lip backend health:', error);
    
    return NextResponse.json(
      { error: 'Cannot connect to Wav2Lip backend' },
      { status: 503 }
    );
  }
}
