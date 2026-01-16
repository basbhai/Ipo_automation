"use client"

import { useEffect, useRef, useState } from "react"

interface LogEntry {
  timestamp: string
  level: "info" | "success" | "warning" | "error"
  message: string
  account?: string
  status?: string
}

interface LogsViewerProps {
  jobId: string
}

export default function LogsViewer({ jobId }: LogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs])

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/logs?jobId=${jobId}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
    }
  }

  // Set up polling
  useEffect(() => {
    fetchLogs() // Initial fetch

    pollIntervalRef.current = setInterval(fetchLogs, 1000) // Poll every second

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [jobId])

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success":
        return "text-green-600 dark:text-green-400"
      case "error":
        return "text-red-600 dark:text-red-400"
      case "warning":
        return "text-yellow-600 dark:text-yellow-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Real-time Logs</h3>
        <span className="text-xs text-muted-foreground">
          {logs.length} log{logs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={logsContainerRef}
        className="bg-muted/30 border border-muted rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto space-y-1"
      >
        {isLoading && logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-20">
            <div className="animate-spin inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
            Waiting for logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-20">No logs yet</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">[{formatTime(log.timestamp)}]</span>
              <span className={`shrink-0 font-semibold ${getLevelColor(log.level)}`}>
                {log.level.toUpperCase().padEnd(7)}
              </span>
              {log.account && <span className="text-blue-600 dark:text-blue-400 shrink-0">{log.account}</span>}
              <span className="flex-1">{log.message}</span>
              {log.status && (
                <span className="text-purple-600 dark:text-purple-400 shrink-0 ml-auto">
                  ({log.status})
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">Logs auto-refresh every second</p>
    </div>
  )
}
