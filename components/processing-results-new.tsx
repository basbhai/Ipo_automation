import React, { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { CheckCircle2, XCircle, Clock } from "lucide-react"

interface AccountResult {
  username: string
  status: "success" | "failed" | "pending"
  message: string
  timestamp?: string
}

interface ProcessingResultsProps {
  jobId: string
  isPolling: boolean
}

export default function ProcessingResults({ jobId, isPolling }: ProcessingResultsProps) {
  const [results, setResults] = useState<AccountResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!isPolling) return

    const pollResults = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/results?jobId=${jobId}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
          setError("")
        } else if (response.status === 404) {
          // Job not found yet - still processing
          setResults([])
        } else {
          setError("Failed to fetch results")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching results")
      } finally {
        setIsLoading(false)
      }
    }

    // Poll every 2 seconds
    const interval = setInterval(pollResults, 2000)
    // Initial fetch
    pollResults()

    return () => clearInterval(interval)
  }, [jobId, isPolling])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200"
      case "failed":
        return "bg-red-50 border-red-200"
      default:
        return "bg-yellow-50 border-yellow-200"
    }
  }

  if (!isPolling || results.length === 0) {
    return null
  }

  const successCount = results.filter((r) => r.status === "success").length
  const failedCount = results.filter((r) => r.status === "failed").length
  const pendingCount = results.filter((r) => r.status === "pending").length

  return (
    <Card className="p-6 mt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Processing Results</h3>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Success: {successCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span>Failed: {failedCount}</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span>Pending: {pendingCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-md border ${getStatusColor(result.status)} flex items-start gap-3`}
          >
            {getStatusIcon(result.status)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{result.username}</p>
              <p className="text-xs text-gray-600 mt-1">{result.message}</p>
              {result.timestamp && (
                <p className="text-xs text-gray-500 mt-1">{new Date(result.timestamp).toLocaleTimeString()}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      {isLoading && <p className="text-sm text-gray-500 mt-4">Fetching results...</p>}
    </Card>
  )
}
