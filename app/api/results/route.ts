import { type NextRequest, NextResponse } from "next/server"

interface AccountResult {
  username: string
  status: "success" | "failed" | "pending"
  message: string
  timestamp: string
}

interface JobResults {
  jobId: string
  createdAt: number
  results: AccountResult[]
}

// In-memory storage - temporary, cleared on server restart
const resultsStore = new Map<string, JobResults>()

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const now = Date.now()
  for (const [jobId, job] of resultsStore.entries()) {
    if (now - job.createdAt > 3600000) {
      resultsStore.delete(jobId)
    }
  }
}, 600000) // Run cleanup every 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { jobId, results } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    if (!Array.isArray(results)) {
      return NextResponse.json({ error: "results must be an array" }, { status: 400 })
    }

    // Store or update results for this job
    resultsStore.set(jobId, {
      jobId,
      createdAt: Date.now(),
      results,
    })

    return NextResponse.json({ success: true, message: "Results stored" }, { status: 200 })
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

    const job = resultsStore.get(jobId)

    if (!job) {
      return NextResponse.json({ error: "Job not found or results expired" }, { status: 404 })
    }

    return NextResponse.json(job, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
