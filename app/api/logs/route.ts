import { type NextRequest, NextResponse } from "next/server"

interface ArtifactMetadata {
  name: string
  size_in_bytes: number
  url: string
  created_at: string
  updated_at: string
  expires_at: string
}

interface ArtifactsResponse {
  total_count: number
  artifacts: ArtifactMetadata[]
}

/**
 * Fetches logs from GitHub artifacts using partial upload ID matching
 * Returns artifact metadata with download URL that can be used directly by GitHub API token holder
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const uploadId = searchParams.get("uploadId")

    if (!uploadId) {
      return NextResponse.json(
        { message: "uploadId query parameter is required" },
        { status: 400 }
      )
    }

    const githubToken = process.env.GITHUB_PAT
    const githubRepo = process.env.GITHUB_REPO

    if (!githubToken || !githubRepo) {
      return NextResponse.json(
        { message: "GitHub configuration missing" },
        { status: 500 }
      )
    }

    // Parse repo in format "owner/repo"
    let owner = ""
    let repo = ""

    if (githubRepo.includes("/")) {
      const parts = githubRepo.split("/")
      owner = parts[parts.length - 2]
      repo = parts[parts.length - 1].replace(/\.git$/, "")
    } else {
      return NextResponse.json(
        { message: "Invalid GITHUB_REPO format" },
        { status: 400 }
      )
    }

    console.log(`[v0] Fetching artifacts for uploadId=${uploadId}`)

    // List artifacts from the repository
    const artifactsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          Accept: "application/vnd.github+json",
        },
      }
    )

    if (!artifactsResponse.ok) {
      const errorData = await artifactsResponse.text()
      console.error("GitHub artifacts fetch error:", errorData)
      return NextResponse.json(
        { message: "Failed to fetch artifacts from GitHub" },
        { status: artifactsResponse.status }
      )
    }

    const artifactsData: ArtifactsResponse = await artifactsResponse.json()
    
    // Find artifact that partially matches the uploadId
    const matchingArtifact = artifactsData.artifacts.find((artifact) =>
      artifact.name.includes(uploadId)
    )

    if (!matchingArtifact) {
      console.log(
        `[v0] No artifact found matching uploadId=${uploadId}. Available artifacts: ${artifactsData.artifacts
          .map((a) => a.name)
          .join(", ")}`
      )
      return NextResponse.json(
        {
          message: `No artifact found matching uploadId: ${uploadId}`,
          availableArtifacts: artifactsData.artifacts.map((a) => ({
            name: a.name,
            size: a.size_in_bytes,
            created: a.created_at,
          })),
        },
        { status: 404 }
      )
    }

    console.log(`[v0] Found matching artifact: ${matchingArtifact.name}`)

    // Return artifact metadata and download URL
    // The frontend can then handle downloading and displaying the content
    return NextResponse.json(
      {
        uploadId,
        artifactName: matchingArtifact.name,
        downloadUrl: matchingArtifact.url,
        size: matchingArtifact.size_in_bytes,
        createdAt: matchingArtifact.created_at,
        expiresAt: matchingArtifact.expires_at,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json(
      { 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
