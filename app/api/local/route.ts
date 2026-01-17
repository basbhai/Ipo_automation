import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

// 1. You still need this to define the structure of incoming data
interface DispatchPayload {
  accounts: Array<{
    dp: string
    username: string
    password: string
    pin: string
    crn: string
    units: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    // 2. TypeScript uses the interface here to validate 'payload'
    const payload: DispatchPayload = await request.json()

    if (!payload.accounts || payload.accounts.length === 0) {
      return NextResponse.json({ message: "No accounts provided" }, { status: 400 })
    }

    // 3. Setup the local file path
    // path.join ensures this works on both Windows and Mac/Linux
    const scriptPath = path.join(process.cwd(), "scripts", "localapply.py")

    // 4. Convert the accounts array to a string to pass as a CLI argument
    const accountsData = JSON.stringify(payload.accounts)

    // 5. Execute the Python script locally
    // Change "python" to "python3" if you are on Mac/Linux
    const pythonProcess = spawn("python", [scriptPath, accountsData])

    // --- DEBUGGING LOGS ---
    // This makes Python's print() statements show up in your VS Code terminal
    pythonProcess.stdout.on("data", (data) => {
      console.log(`[PYTHON]: ${data.toString()}`)
    })

    pythonProcess.stderr.on("data", (data) => {
      console.error(`[PYTHON ERROR]: ${data.toString()}`)
    })

    return NextResponse.json({ 
      message: "Local script execution started",
      accountCount: payload.accounts.length 
    }, { status: 200 })

  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}