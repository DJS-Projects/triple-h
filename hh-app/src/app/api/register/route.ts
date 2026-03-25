import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// import { prisma } from "../../../../lib/prisma"; // Commented out for dashboard development

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json();

    // Basic validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // TEMPORARY: Comment out Prisma logic for dashboard development
    // // Check if user already exists
    // const existingUser = await prisma.user.findUnique({
    //   where: { email }
    // });

    // if (existingUser) {
    //   return NextResponse.json(
    //     { error: "User with this email already exists" },
    //     { status: 400 }
    //   );
    // }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // TEMPORARY: Comment out user creation for dashboard development
    // // Create user
    // const user = await prisma.user.create({
    //   data: {
    //     name,
    //     email,
    //     password: hashedPassword,
    //     role: role || "CANDIDATE",
    //   },
    // });

    // // Return user without password
    // const { password: _, ...userWithoutPassword } = user;
    
    // Mock user response for development
    const mockUser = {
      id: "mock-user-id",
      name,
      email,
      role: role || "CANDIDATE",
    };

    return NextResponse.json(
      { message: "User registered successfully (mock)", user: mockUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
