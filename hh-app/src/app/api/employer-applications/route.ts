import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// Get employer applications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employerEmail = searchParams.get('employerEmail');

    if (!employerEmail) {
      return NextResponse.json(
        { error: 'Employer email is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/applications/applications/employer/${encodeURIComponent(employerEmail)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch employer applications' },
        { status: response.status }
      );
    }

    const applications = await response.json();
    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error fetching employer applications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}