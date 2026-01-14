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
    const template = "dp,username,password,pin,crn,units\n1234567,user@meroshare,password123,1234,12345678,100\n"
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

          // Validation
          const validAccounts = parsedAccounts.filter((acc: Account) => {
            return acc.dp && acc.username && acc.password && acc.pin && acc.crn && acc.units
          })

          if (validAccounts.length !== parsedAccounts.length) {
            setStatus(
              `Warning: ${parsedAccounts.length - validAccounts.length} rows were skipped due to missing fields.`,
            )
          }

          setAccounts(validAccounts)
          setStatus(`Loaded ${validAccounts.length} valid account(s).`)
        },
        error: (error: any) => {
          setStatus(`Error parsing CSV: ${error.message}`)
        },
      })
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const startProcess = async () => {
    if (accounts.length === 0) {
      setStatus("Please upload a CSV file with accounts first.")
      return
    }

    if (!process.env.NEXT_PUBLIC_APP_NAME) {
      setStatus("Application not properly configured. Contact administrator.")
      return
    }

    try {
      setIsProcessing(true)
      setStatus("Initiating IPO application process...")

      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accounts: accounts,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        setStatus("✓ Process initiated! Check GitHub Actions for real-time progress.")
      } else {
        setStatus(`Error: ${responseData.message || "Failed to start process"}`)
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload Section */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Prepare Accounts</h2>

            <div className="space-y-4">
              <Button variant="outline" onClick={downloadTemplate} className="w-full bg-transparent">
                Download CSV Template
              </Button>

              <CSVUploadArea onFileUpload={handleFileUpload} />
            </div>
          </Card>

          {/* Status Section */}
          <ProcessingStatus
            status={status}
            accountsCount={accounts.length}
            isProcessing={isProcessing}
            onStartProcess={startProcess}
          />
        </div>

        {/* Accounts Table */}
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
