import { NextResponse } from "next/server";

// 👇 TEMP: must be same users array used in register (in reality, use DB)
let users: { name: string; email: string; password: string }[] = [];

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  // Find user
  const user = users.find(user => user.email === email);

  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // ✅ If success
  return NextResponse.json(
    { message: "Login successful", user: { name: user.name, email: user.email } },
    { status: 200 }
  );
}
