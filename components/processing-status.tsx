"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface ProcessingStatusProps {
  status: string
  accountsCount: number
  isProcessing: boolean
  onStartProcess: () => void
}

export default function ProcessingStatus({
  status,
  accountsCount,
  isProcessing,
  onStartProcess,
}: ProcessingStatusProps) {
  return (
    <div className="space-y-4">
      <div className="bg-accent/10 border border-accent rounded-lg p-4">
        <h3 className="font-semibold mb-2">Status</h3>
        <p className="text-sm text-muted-foreground mb-3">{status || "Ready to upload CSV file with accounts"}</p>
        {accountsCount > 0 && (
          <p className="text-sm font-medium text-accent mb-3">{accountsCount} account(s) ready for processing</p>
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
    </div>
  )
}
