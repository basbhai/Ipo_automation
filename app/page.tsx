"use client"

import { useState, useRef, useEffect } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import DashboardHeader from "@/components/dashboard-header"
import CSVUploadArea from "@/components/csv-upload-area"
import AccountsTable from "@/components/accounts-table"
import ProcessingStatus from "@/components/processing-status"

interface Account {
  name: string
  dp: string
  username: string
  password: string
  pin: string
  crn: string
  units: string
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [logs, setLogs] = useState<string[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [results, setResults] = useState<Record<string, string>>({})
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null)

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const handleFileUpload = async (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const parsedAccounts = results.data.map((row: any) => ({
          name: String(row.name || row.Name || ""),
          dp: String(row.dp || ""),
          username: String(row.username || ""),
          password: String(row.password || ""),
          pin: String(row.pin || ""),
          crn: String(row.crn || ""),
          units: String(row.units || ""),
        }))
        const valid = parsedAccounts.filter((a: Account) => a.username && a.password)
        setAccounts(valid)
        setStatus(`Loaded ${valid.length} accounts. Ready to apply.`)
      },
    })
  }

  // --- FETCH LOGS FROM CALLBACK ---
  const fetchLiveLogs = async (runId: string) => {
    try {
      const response = await fetch(`/api/callback?runId=${runId}`)
      const data = await response.json()

      if (data.logs && data.logs.length > 0) {
        // 1. Update terminal logs
        const formattedLogs = data.logs.map((log: any) => 
          `[${log.time || ''}] ${log.username.toUpperCase()}: ${log.message}`
        )
        setLogs(formattedLogs)

        // 2. Update summary
        const newResults: Record<string, string> = {}
        data.logs.forEach((log: any) => {
          const account = accounts.find(acc => String(acc.username) === String(log.username))
          const displayName = account ? account.name : log.username

          if (log.status === "success") {
            newResults[displayName] = "✅ Successfully Applied"
          } else if (log.status === "skip") {
            newResults[displayName] = "ℹ️ Already Applied"
          } else {
            newResults[displayName] = "❌ Error/Failed"
          }
        })
        setResults(prev => ({ ...prev, ...newResults }))

        // 3. Logic: If the number of processed accounts equals total accounts, we are done
        const processedCount = data.logs.filter((l: any) => l.status === "success" || l.status === "failed" || l.status === "skip").length
        if (processedCount >= accounts.length && accounts.length > 0) {
            return true 
        }
      }
      return false
    } catch (err) {
      console.error("Error fetching live logs:", err)
      return false
    }
  }

  const startProcess = async () => {
    if (accounts.length === 0) return setStatus("Please upload accounts first.")
    
    try {
      setIsProcessing(true)
      setStatus("Triggering Bot...")
      setLogs(["Initializing session..."])
      setResults({})
      setShowSummary(false)

      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Dispatch failed")

      // --- HERE IS THE RUN ID ---
      const runId = data.workflow_run_id
      if (runId) {
        setWorkflowRunId(runId) // Save it to state
        setStatus("Bot started! Watching live feed...")
        
        // Start simple interval to check logs every 4 seconds
        const interval = setInterval(async () => {
          const isDone = await fetchLiveLogs(runId)
          if (isDone) {
            clearInterval(interval)
            setIsProcessing(false)
            setStatus("Process Complete.")
            setShowSummary(true)
          }
        }, 4000)
      }
    } catch (err: any) {
      setStatus("Error starting process.")
      setLogs(prev => [...prev, `❌ ERROR: ${err.message}`])
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">1. Setup</h2>
            <Button variant="outline" onClick={() => {
                const template = "name,dp,username,password,pin,crn,units\nJohn Doe,13000,12345678,Pass123,1111,100,10\n"
                const element = document.createElement("a")
                element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template))
                element.setAttribute("download", "template.csv")
                element.click()
            }} className="w-full mb-4">
              Download CSV Template
            </Button>
            <CSVUploadArea onFileUpload={handleFileUpload} />
          </Card>
          <ProcessingStatus
            status={status}
            accountsCount={accounts.length}
            isProcessing={isProcessing}
            onStartProcess={startProcess}
          />
        </div>

        {/* Console Logs Terminal */}
        {(logs.length > 0 || isProcessing) && (
          <Card className="mt-6 p-4 bg-slate-900 text-green-400 font-mono text-xs shadow-xl">
            <div className="flex justify-between border-b border-slate-700 pb-2 mb-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Bot Terminal Output</span>
              {isProcessing && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-green-500 font-bold">LIVE FEED</span>
                </div>
              )}
            </div>
            <div className="h-64 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="opacity-90 leading-relaxed">
                  <span className="text-slate-600 mr-2">[{i + 1}]</span>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </Card>
        )}

        {/* Summary Modal */}
        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white overflow-hidden shadow-2xl">
              <div className="p-6 bg-slate-50 border-b font-bold text-xl">Execution Summary</div>
              <div className="max-h-80 overflow-y-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 uppercase text-xs font-bold text-slate-500">
                    <tr>
                      <th className="p-4 text-left">Name</th>
                      <th className="p-4 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(results).map(([name, res]) => (
                      <tr key={name} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold uppercase">{name}</td>
                        <td className={`p-4 font-medium ${res.includes("✅") ? "text-green-600" : res.includes("ℹ️") ? "text-blue-500" : "text-red-500"}`}>{res}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button onClick={() => setShowSummary(false)} className="bg-slate-900 text-white">
                  Close Summary
                </Button>
              </div>
            </Card>
          </div>
        )}

        {accounts.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Loaded CSV Data</h2>
            <AccountsTable accounts={accounts} />
          </Card>
        )}
      </div>
    </main>
  )
}