import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// Apply to job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Applying to job:', body);
    
    const response = await fetch(`${BACKEND_URL}/applications/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend response not ok:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to apply to job' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Application submitted successfully:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error applying to job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get candidate applications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const candidateEmail = searchParams.get('candidateEmail');
    
    if (!candidateEmail) {
      return NextResponse.json(
        { error: 'Candidate email is required' },
        { status: 400 }
      );
    }

    console.log('Fetching applications for:', candidateEmail);
    
    const response = await fetch(`${BACKEND_URL}/applications/applications/${encodeURIComponent(candidateEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend response not ok:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch applications' },
        { status: response.status }
      );
    }

    const applications = await response.json();
    console.log('Applications fetched successfully:', applications.length, 'applications');
    
    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

