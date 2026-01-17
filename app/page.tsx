"use client"

import { useState } from "react"
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
      setStatus("Initiating process...")

      /* ===========================================================
      LOCAL DEBUGGING (ACTIVE)
      ===========================================================
      */
      const response = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      })

      /* ===========================================================
      GITHUB ACTION (LIVE MODE - UNCOMMENT THIS WHEN DEPLOYING)
      ===========================================================
      
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      })
      */

      const responseData = await response.json()

      if (response.ok) {
        setStatus("✓ Success! Check your terminal for local logs.")
      } else {
        setStatus(`Error: ${responseData.message}`)
      }
    } catch (error) {
      setStatus("Connection error.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
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