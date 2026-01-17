"use client"

import { useState, useRef, useEffect } from "react"
import Papa from "papaparse"
import CryptoJS from "crypto-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import DashboardHeader from "@/components/dashboard-header"
import CSVUploadArea from "@/components/csv-upload-area"
import AccountsTable from "@/components/accounts-table"
import ProcessingStatus from "@/components/processing-status"

interface Account {
  name: string;
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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // --- LOG PARSER: Maps Python output back to Account Names ---
  const parseLogForSummary = (line: string) => {
    const userMatch = line.match(/(?:Account:|for|Account)\s*(\d+)/i);
    if (userMatch) {
      const userId = userMatch[1];
      // Find the name in our state matching the ID from the log
      const account = accounts.find(acc => String(acc.username) === String(userId));
      const displayName = account ? account.name : `ID: ${userId}`;

      if (line.includes("SUCCESS")) {
        setResults(prev => ({ ...prev, [displayName]: "✅ Successfully Applied" }));
      } else if (line.includes("SKIP") || line.includes("Already")) {
        setResults(prev => ({ ...prev, [displayName]: "ℹ️ Already Applied" }));
      } else if (line.includes("FAIL") || line.includes("ERROR")) {
        setResults(prev => ({ ...prev, [displayName]: "❌ Failed / Error" }));
      }
    }
  };

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
        setStatus(`Loaded ${valid.length} accounts.`)
      },
    })
  }

  const startProcess = async () => {
    if (accounts.length === 0) return setStatus("No accounts loaded.")

    try {
      setIsProcessing(true)
      setStatus("Encrypting & starting automation...")
      setLogs([]) 
      setResults({}) 
      setShowSummary(false)

      // 1. Encrypt Data
      const secretKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
      if (!secretKey) throw new Error("Encryption key missing in .env.local")
      
      const encryptedPayload = CryptoJS.AES.encrypt(
        JSON.stringify(accounts), 
        secretKey
      ).toString();

      // 2. Send Encrypted Payload
      const response = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encryptedPayload }), 
      })

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          setIsProcessing(false)
          setShowSummary(true)
          setStatus("✓ Process Complete.")
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        chunk.split("\n").filter(l => l.trim()).forEach(line => {
          parseLogForSummary(line) 
          setLogs(prev => [...prev, line])
        })
      }
    } catch (error: any) {
      setStatus("Error starting process.")
      setLogs(prev => [...prev, `❌ ERROR: ${error.message}`])
      setIsProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const template = "name,dp,username,password,pin,crn,units\nbasanta,13000,12345678,Pass123,1111,100,10\n"
    const element = document.createElement("a")
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template))
    element.setAttribute("download", "template.csv")
    element.click()
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">1. Setup</h2>
            <Button variant="outline" onClick={downloadTemplate} className="w-full mb-4">Download CSV Template</Button>
            <CSVUploadArea onFileUpload={handleFileUpload} />
          </Card>
          <ProcessingStatus status={status} accountsCount={accounts.length} isProcessing={isProcessing} onStartProcess={startProcess} />
        </div>

        {/* Console Logs */}
        {(logs.length > 0 || isProcessing) && (
          <Card className="mt-6 p-4 bg-slate-900 text-green-400 font-mono text-xs shadow-xl">
            <div className="flex justify-between border-b border-slate-700 pb-2 mb-2">
              <span className="text-slate-400 font-bold">TERMINAL OUTPUT</span>
              {isProcessing && <span className="animate-pulse text-green-500">● LIVE</span>}
            </div>
            <div className="h-64 overflow-y-auto">
              {logs.map((log, i) => <div key={i} className="opacity-90"><span className="text-slate-600 mr-2">{i+1}</span>{log}</div>)}
              <div ref={logEndRef} />
            </div>
          </Card>
        )}

        {/* Modal */}
        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white overflow-hidden shadow-2xl">
              <div className="p-6 bg-slate-50 border-b font-bold text-xl">Execution Summary</div>
              <div className="max-h-80 overflow-y-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 uppercase text-xs font-bold text-slate-500">
                    <tr><th className="p-4 text-left">Name</th><th className="p-4 text-left">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(results).map(([name, res]) => (
                      <tr key={name} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold uppercase">{name}</td>
                        <td className={`p-4 font-medium ${res.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{res}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button onClick={() => setShowSummary(false)} className="bg-slate-900 text-white">Close Summary</Button>
              </div>
            </Card>
          </div>
        )}

        {accounts.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-bold mb-4">Loaded Data</h2>
            <AccountsTable accounts={accounts} />
          </Card>
        )}
      </div>
    </main>
  )
}