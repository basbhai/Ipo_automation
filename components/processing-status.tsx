"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import LogsViewerModal from "@/components/logs-viewer-modal"
import { Eye } from "lucide-react"

interface ProcessingStatusProps {
  status: string
  accountsCount: number
  isProcessing: boolean
  onStartProcess: () => void
  uploadId?: string | null
}

export default function ProcessingStatus({
  status,
  accountsCount,
  isProcessing,
  onStartProcess,
  uploadId,
}: ProcessingStatusProps) {
  const [showLogsModal, setShowLogsModal] = useState(false)
  return (
    <>
      <div className="space-y-4">
        <div className="bg-accent/10 border border-accent rounded-lg p-4">
          <h3 className="font-semibold mb-2">Status</h3>
          <p className="text-sm text-muted-foreground mb-3">{status || "Ready to upload CSV file with accounts"}</p>
          {accountsCount > 0 && (
            <p className="text-sm font-medium text-accent mb-3">{accountsCount} account(s) ready for processing</p>
          )}
          {uploadId && (
            <div className="mt-3 pt-3 border-t border-accent/30">
              <p className="text-xs text-muted-foreground mb-1">Upload ID:</p>
              <p className="font-mono text-xs text-accent break-all">{uploadId}</p>
            </div>
          )}
        </div>

        <Button onClick={onStartProcess} disabled={accountsCount === 0 || isProcessing} className="w-full">
          {isProcessing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            "Start IPO Application"
          )}
        </Button>

        {uploadId && (
          <Button 
            variant="outline" 
            onClick={() => setShowLogsModal(true)} 
            className="w-full"
          >
            <Eye className="mr-2 h-4 w-4" />
            View Workflow Logs
          </Button>
        )}
      </div>

      <LogsViewerModal 
        isOpen={showLogsModal} 
        uploadId={uploadId || null}
        onClose={() => setShowLogsModal(false)}
      />
    </>
  )
}
