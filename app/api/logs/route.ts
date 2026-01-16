import { type NextRequest, NextResponse } from "next/server"

interface LogEntry {
  timestamp: string
  level: "info" | "success" | "warning" | "error"
  message: string
  account?: string
  status?: string
}

interface JobLogs {
  jobId: string
  createdAt: number
  logs: LogEntry[]
}

// In-memory storage for logs
const logsStore = new Map<string, JobLogs>()

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const now = Date.now()
  for (const [jobId, job] of logsStore.entries()) {
    if (now - job.createdAt > 3600000) {
      logsStore.delete(jobId)
    }
  }
}, 600000) // Run cleanup every 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { jobId, level = "info", message, account, status } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    // Create or update logs for this job
    if (!logsStore.has(jobId)) {
      logsStore.set(jobId, {
        jobId,
        createdAt: Date.now(),
        logs: [],
      })
    }

    const job = logsStore.get(jobId)!
    const timestamp = new Date().toISOString()

    job.logs.push({
      timestamp,
      level,
      message,
      account,
      status,
    })

    console.log(`[LOG ${jobId}] [${level.toUpperCase()}] ${message}`)

    return NextResponse.json({ success: true, message: "Log entry stored" }, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json({ error: "jobId query parameter is required" }, { status: 400 })
    }

    const job = logsStore.get(jobId)

    if (!job) {
      return NextResponse.json({ error: "Job not found or logs expired" }, { status: 404 })
    }

    return NextResponse.json(job, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
