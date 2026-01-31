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
 * Downloads artifact zip file using GitHub API authentication
 * This endpoint handles the secure download of artifacts by proxying through the server
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

    console.log(`[v0] Downloading artifact for uploadId=${uploadId}`)

    // List artifacts from the repository to find matching one
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
      return NextResponse.json(
        { message: `No artifact found matching uploadId: ${uploadId}` },
        { status: 404 }
      )
    }

    console.log(`[v0] Downloading artifact: ${matchingArtifact.name}`)

    // Download the artifact zip file
    const downloadResponse = await fetch(matchingArtifact.url, {
      headers: {
        Authorization: `token ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "follow",
    })

    if (!downloadResponse.ok) {
      console.error("GitHub artifact download error:", downloadResponse.statusText)
      return NextResponse.json(
        { message: "Failed to download artifact from GitHub" },
        { status: downloadResponse.status }
      )
    }

    const zipBuffer = await downloadResponse.arrayBuffer()

    // Return the zip file with appropriate headers
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${matchingArtifact.name}.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("[v0] Download API error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
