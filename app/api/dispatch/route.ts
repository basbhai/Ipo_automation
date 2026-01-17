// /api/dispatch.ts
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { accounts } = await request.json()

    if (!accounts || !Array.isArray(accounts)) {
      return NextResponse.json({ message: "Accounts payload missing or invalid" }, { status: 400 })
    }

    // 1️⃣ GitHub info
    const githubToken = process.env.GITHUB_PAT
    const githubRepo = process.env.GITHUB_REPO // e.g., "basbhai/Ipo_automation"

    if (!githubToken || !githubRepo) {
      return NextResponse.json(
        { message: "GitHub PAT or Repo variable missing in Vercel settings." },
        { status: 500 }
      )
    }

    const [owner, repo] = githubRepo.replace(".git", "").split("/")

    // 2️⃣ Trigger GitHub Action
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        event_type: "trigger_ipo_bot",
        client_payload: { accounts },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      return NextResponse.json({ message: `GitHub Error: ${errorData}` }, { status: response.status })
    }

    // 3️⃣ Get latest workflow run ID for frontend polling
    const runsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=repository_dispatch&per_page=1`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    )
    const runsJson = await runsRes.json()
    const runId = runsJson.workflow_runs?.[0]?.id

    return NextResponse.json({
      message: "Success! GitHub Action triggered.",
      workflow_run_id: runId,
    })
  } catch (error) {
    console.error("Dispatch Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
