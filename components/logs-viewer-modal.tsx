"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { X, Download, RefreshCw } from "lucide-react"

interface LogsViewerModalProps {
  isOpen: boolean
  uploadId: string | null
  onClose: () => void
}

interface ArtifactData {
  uploadId: string
  artifactName: string
  downloadUrl: string
  size: number
  createdAt: string
  expiresAt: string
}

export default function LogsViewerModal({ isOpen, uploadId, onClose }: LogsViewerModalProps) {
  const [loading, setLoading] = useState(false)
  const [logsContent, setLogsContent] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [artifactData, setArtifactData] = useState<ArtifactData | null>(null)

  useEffect(() => {
    if (isOpen && uploadId) {
      fetchLogs()
    }
  }, [isOpen, uploadId])

  const fetchLogs = async () => {
    if (!uploadId) return

    setLoading(true)
    setError("")
    setLogsContent("")
    setArtifactData(null)

    try {
      console.log("[v0] Fetching logs for uploadId:", uploadId)

      // First, fetch artifact metadata
      const response = await fetch(`/api/logs?uploadId=${encodeURIComponent(uploadId)}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(
          errorData.message || `Failed to fetch logs (Status: ${response.status})`
        )
        return
      }

      const data: ArtifactData = await response.json()
      setArtifactData(data)

      console.log("[v0] Artifact found:", data.artifactName)

      // Now download the artifact zip file
      // Note: The artifact URL requires authentication with GitHub token
      // For security, we should proxy this through the backend
      // For now, we'll show the artifact info and provide a download button
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      console.error("[v0] Error fetching logs:", errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!artifactData) return

    try {
      // Create a proxy route to download the artifact safely with token auth
      const downloadResponse = await fetch(
        `/api/logs/download?uploadId=${encodeURIComponent(uploadId || "")}`
      )

      if (!downloadResponse.ok) {
        setError("Failed to download artifact")
        return
      }

      const blob = await downloadResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${artifactData.artifactName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Download failed"
      setError(errorMessage)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Workflow Logs</DialogTitle>
          <DialogDescription>
            Upload ID: <span className="font-mono text-foreground">{uploadId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner className="mr-2 h-5 w-5" />
              <p className="text-sm text-muted-foreground">Fetching artifact information...</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {artifactData && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Artifact Name</p>
                  <p className="font-mono text-sm break-all">{artifactData.artifactName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Size</p>
                  <p className="text-sm">
                    {(artifactData.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Created</p>
                  <p className="text-sm">
                    {new Date(artifactData.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Expires</p>
                  <p className="text-sm">
                    {new Date(artifactData.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Logs Content:</p>
                {logsContent ? (
                  <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words">
                    {logsContent}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Logs content will be displayed here after download
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={fetchLogs}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Artifact
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && !artifactData && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Click "Refresh" to fetch artifact information
              </p>
              <Button variant="outline" size="sm" onClick={fetchLogs} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Fetch Logs
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
