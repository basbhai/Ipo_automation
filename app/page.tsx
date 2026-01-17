"use client"

import { useState, useRef, useEffect } from "react" // Added useRef and useEffect
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import DashboardHeader from "@/components/dashboard-header"
import CSVUploadArea from "@/components/csv-upload-area"
import AccountsTable from "@/components/accounts-table"
import ProcessingStatus from "@/components/processing-status"

interface Account {
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
  
  // NEW: State for live logs
  const [logs, setLogs] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const downloadTemplate = () => {
    const template = "dp,username,password,pin,crn,units\n13000,12345678,Password123,1111,10012345678,10\n"
    const element = document.createElement("a")
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template))
    element.setAttribute("download", "accounts_template.csv")
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleFileUpload = async (file: File) => {
    try {
      setStatus("Parsing CSV file...")
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const parsedAccounts = results.data.map((row: any) => ({
            dp: String(row.dp || ""),
            username: String(row.username || ""),
            password: String(row.password || ""),
            pin: String(row.pin || ""),
            crn: String(row.crn || ""),
            units: String(row.units || ""),
          }))
          const validAccounts = parsedAccounts.filter((acc: Account) => {
            return acc.dp && acc.username && acc.password && acc.pin && acc.crn && acc.units
          })
          setAccounts(validAccounts)
          setStatus(`Loaded ${validAccounts.length} valid account(s).`)
        },
      })
    } catch (error) {
      setStatus("Error reading file.")
    }
  }

  const startProcess = async () => {
    if (accounts.length === 0) {
      setStatus("Please upload accounts first.")
      return
    }

    try {
      setIsProcessing(true)
      setStatus("Initiating local process...")
      setLogs([]) // Clear previous logs

      const response = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      })

      if (!response.body) {
        throw new Error("No response body")
      }

      // STREAM READING LOGIC
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const textChunk = decoder.decode(value, { stream: true })
        
        // Split chunk by newline and add to logs
        const newLines = textChunk.split("\n").filter(line => line.trim() !== "")
        setLogs((prev) => [...prev, ...newLines])
      }

      setStatus("✓ Process Completed.")
    } catch (error) {
      console.error(error)
      setStatus("Connection error.")
      setLogs((prev) => [...prev, "❌ ERROR: Failed to connect to local server."])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Prepare Accounts</h2>
            <div className="space-y-4">
              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                Download CSV Template
              </Button>
              <CSVUploadArea onFileUpload={handleFileUpload} />
            </div>
          </Card>

          <ProcessingStatus
            status={status}
            accountsCount={accounts.length}
            isProcessing={isProcessing}
            onStartProcess={startProcess}
          />
        </div>

        {/* NEW: LIVE LOG VIEWER */}
        {(logs.length > 0 || isProcessing) && (
          <Card className="mt-6 p-4 bg-slate-950 text-slate-50 font-mono text-sm border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Execution Logs</span>
              {isProcessing && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
            </div>
            <div className="h-64 overflow-y-auto space-y-1 scrollbar-hide">
              {logs.map((log, index) => (
                <div key={index} className="break-all">
                  <span className="text-slate-500 mr-2">[{index + 1}]</span>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </Card>
        )}

        {accounts.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Loaded Accounts</h2>
            <AccountsTable accounts={accounts} />
          </Card>
        )}
      </div>
    </main>
  )
}