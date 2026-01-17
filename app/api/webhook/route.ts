import { NextResponse } from "next/server";

// This is a temporary storage in memory (Note: Vercel may reset this, 
// but for a 5-min window, it often works for single users).
let latestResults: any = null;

export async function POST(req: Request) {
  const data = await req.json();
  latestResults = data.results; // Save results sent from Python
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ results: latestResults });
}
