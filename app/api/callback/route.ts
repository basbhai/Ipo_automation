import { NextRequest, NextResponse } from "next/server";

// This pattern prevents the store from being cleared during development HMR
const globalForLogs = global as unknown as { logStore: Record<string, any[]> };
const logStore = globalForLogs.logStore || {};
if (process.env.NODE_ENV !== "production") globalForLogs.logStore = logStore;

export async function POST(req: NextRequest) {
  try {
    const { runId, username, status, message } = await req.json();

    if (!runId) return NextResponse.json({ error: "No runId" }, { status: 400 });

    if (!logStore[runId]) {
        logStore[runId] = [];
    }

    // Add new log
    logStore[runId].push({
      time: new Date().toLocaleTimeString(),
      username,
      status,
      message
    });

    // Optional: Keep only the last 100 logs per run to save memory
    if (logStore[runId].length > 100) {
        logStore[runId].shift();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to store log" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (!runId) return NextResponse.json({ logs: [] });

  return NextResponse.json({ logs: logStore[runId] || [] });
}