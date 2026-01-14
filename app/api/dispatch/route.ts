import { type NextRequest, NextResponse } from "next/server"

interface DispatchPayload {
  accounts: Array<{
    dp: string
    username: string
    password: string
    pin: string
    crn: string
    units: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const payload: DispatchPayload = await request.json()

    if (!payload.accounts || payload.accounts.length === 0) {
      return NextResponse.json({ message: "No accounts provided" }, { status: 400 })
    }

    const githubToken = process.env.GITHUB_PAT
    const githubRepo = process.env.GITHUB_REPO

    if (!githubToken || !githubRepo) {
      return NextResponse.json(
        { message: "GitHub configuration missing. Please set GITHUB_PAT and GITHUB_REPO environment variables." },
        { status: 500 },
      )
    }

    // Parse repo in format "owner/repo" and handle URL variants
    let owner = ""
    let repo = ""

    if (githubRepo.includes("/")) {
      const parts = githubRepo.split("/")
      owner = parts[parts.length - 2] // Get second-to-last part
      repo = parts[parts.length - 1] // Get last part
      // Remove .git suffix if present
      repo = repo.replace(/\.git$/, "")
    } else {
      return NextResponse.json({ message: "Invalid GITHUB_REPO format. Expected 'owner/repo'." }, { status: 400 })
    }

    // Validate that we have valid owner and repo
    if (!owner || !repo || owner.includes("://") || owner.includes("https")) {
      return NextResponse.json(
        {
          message: `Invalid GitHub configuration: owner='${owner}', repo='${repo}'. Please set GITHUB_REPO to 'owner/repo' format (e.g., 'myusername/mero-share-automator').`,
        },
        { status: 400 },
      )
    }

    // Convert accounts to JSON string for GitHub dispatch
    const accountsJson = JSON.stringify(payload.accounts)

    console.log(`[v0] Dispatching to GitHub: owner=${owner}, repo=${repo}`)

    // Trigger GitHub Actions workflow
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        event_type: "trigger_ipo_bot",
        client_payload: {
          accounts: accountsJson,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("GitHub dispatch error:", errorData)
      return NextResponse.json(
        {
          message: `Failed to trigger workflow. Check that GITHUB_PAT has 'repo' permissions and GITHUB_REPO is correct (got owner='${owner}', repo='${repo}').`,
        },
        { status: response.status },
      )
    }

    return NextResponse.json({ message: "IPO application process initiated successfully" }, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
