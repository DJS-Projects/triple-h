import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// Save job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Saving job:', body);
    
    const response = await fetch(`${BACKEND_URL}/applications/save`, {
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
        { error: errorData.detail || 'Failed to save job' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Job saved successfully:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get saved jobs
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

    console.log('Fetching saved jobs for:', candidateEmail);
    
    const response = await fetch(`${BACKEND_URL}/applications/saved/${encodeURIComponent(candidateEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend response not ok:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch saved jobs' },
        { status: response.status }
      );
    }

    const savedJobs = await response.json();
    console.log('Saved jobs fetched successfully:', savedJobs.length, 'jobs');
    
    return NextResponse.json(savedJobs);
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Remove saved job
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const savedJobId = searchParams.get('savedJobId');
    
    if (!savedJobId) {
      return NextResponse.json(
        { error: 'Saved job ID is required' },
        { status: 400 }
      );
    }

    console.log('Removing saved job:', savedJobId);
    
    const response = await fetch(`${BACKEND_URL}/applications/saved/${savedJobId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend response not ok:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to remove saved job' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Saved job removed successfully:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error removing saved job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

