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
  name:string;
  dp: string; 
  username: string; 
  password: string; 
  pin: string; 
  crn: string; 
  units: string;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [logs, setLogs] = useState<string[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [results, setResults] = useState<Record<string, string>>({})
  
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // --- LOG PARSER: Fills the summary table in real-time ---
  const parseLogForSummary = (line: string) => {
    const userMatch = line.match(/(?:Account:|for|Account)\s*(\d+)/i);
    if (userMatch) {
      const userId = userMatch[1];
      const account = accounts.find(acc => String(acc.username) === String(userId));
      const displayName = account ? account.name : userId; // Fallback to ID if name not found
      if (line.includes("SUCCESS")) {
        setResults(prev => ({ ...prev, [displayName]: "✅ Successfully Applied" }));
      } else if (line.includes("SKIP") || line.includes("Already")) {
        setResults(prev => ({ ...prev, [displayName]: "ℹ️ Already Applied" }));
      } else if (line.includes("FAIL") || line.includes("ERROR")) {
        setResults(prev => ({ ...prev, [userId]: "❌ Failed / Error" }));
      } else if (!results[userId]) {
        setResults(prev => ({ ...prev, [displayName]: "⏳ Processing..." }));
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setStatus("Parsing CSV file...")
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const parsedAccounts = results.data.map((row: any) => ({
            // Use row["name"] if your CSV header is lowercase "name"
            // If your CSV has "Name", change this to row["Name"]
            name: String(row.name || row.Name || ""), 
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
          setStatus(`Loaded ${validAccounts.length} account(s).`)
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
      setStatus("Running automation...")
      setLogs([]) 
      setResults({}) 
      setShowSummary(false)

      const response = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }), 
      })

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        
        if (done) {
          setIsProcessing(false)
          setShowSummary(true) // Open popup when Python finishes
          setStatus("✓ All tasks completed.")
          break
        }

        const textChunk = decoder.decode(value, { stream: true })
        const newLines = textChunk.split("\n").filter(line => line.trim() !== "")
        
        newLines.forEach(line => {
          parseLogForSummary(line) 
          setLogs(prev => [...prev, line])
        })
      }
    } catch (error) {
      setStatus("Connection error.")
      setLogs((prev) => [...prev, "❌ ERROR: Could not connect to the automation server."])
      setIsProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const template = "name,dp,username,password,pin,crn,units\nbasanta,13000,12345678,Password123,1111,10012345678,10\n"
    const element = document.createElement("a")
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template))
    element.setAttribute("download", "accounts_template.csv")
    element.click()
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">1. Prepare Accounts</h2>
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

        {/* LIVE LOG VIEWER */}
        {(logs.length > 0 || isProcessing) && (
          <Card className="mt-6 p-4 bg-slate-900 text-green-400 font-mono text-xs border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Output Logs</span>
              {isProcessing && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
            </div>
            <div className="h-64 overflow-y-auto space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="opacity-90">
                  <span className="text-slate-600 mr-2">{index + 1}</span>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </Card>
        )}

        {/* SUMMARY MODAL POPUP */}
        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg shadow-2xl bg-white animate-in zoom-in-95">
              <div className="p-6 border-b bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Application Summary</h2>
                <p className="text-sm text-slate-500">The process has finished. Here are the results:</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="p-3 text-xs font-bold uppercase text-slate-600 border-b">Name</th>
                      <th className="p-3 text-xs font-bold uppercase text-slate-600 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(results).map(([id, res]) => (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-sm text-slate-700 uppercase">{id}</td>
                        <td className={`p-3 text-sm font-semibold ${res.includes('✅') ? 'text-green-600' : 'text-slate-600'}`}>
                          {res}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button onClick={() => setShowSummary(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                  Got it
                </Button>
              </div>
            </Card>
          </div>
        )}

        {accounts.length > 0 && (
          <Card className="mt-6 p-6 border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">Loaded Accounts</h2>
            <AccountsTable accounts={accounts} />
          </Card>
        )}
      </div>
    </main>
  )
}