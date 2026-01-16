# Real-Time Logging System - Architecture & Diagrams

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User's Browser                                   │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                       React Frontend                              │ │
│  │                                                                   │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  Main Page Component (app/page.tsx)                        │ │ │
│  │  │  - Generate jobId on start                                │ │ │
│  │  │  - Send to /api/dispatch                                  │ │ │
│  │  │  - Display LogsViewer component                           │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  │                           │                                      │ │
│  │                           ↓                                      │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  LogsViewer Component (components/logs-viewer.tsx)        │ │ │
│  │  │  - Polls /api/logs?jobId=XXX every 1 sec                 │ │ │
│  │  │  - Auto-scrolls to latest logs                            │ │ │
│  │  │  - Color-codes by severity                                │ │ │
│  │  │  - Shows account names and status                         │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                    │                             ↑
                    │ POST /api/dispatch          │ GET /api/logs?jobId=XXX
                    │ { jobId, accounts }         │
                    │                             │
                    ↓                             │
┌─────────────────────────────────────────────────────────────────────────┐
│                    Your Vercel/Next.js Server                            │
│                                                                           │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │   /api/dispatch (route.ts)       │  │  /api/logs (route.ts)       │ │
│  │                                  │  │                              │ │
│  │  POST Endpoint:                  │  │  POST: Store logs           │ │
│  │  - Receive { jobId, accounts }   │  │  - jobId, level, message    │ │
│  │  - Validate input                │  │  - account, status          │ │
│  │  - Generate GitHub dispatch      │  │  - Store in memory          │ │
│  │  - Include logsWebhookUrl        │  │                              │ │
│  │  - Include jobId                 │  │  GET: Retrieve logs         │ │
│  │  - Return jobId to frontend      │  │  - Query: ?jobId=XXX        │ │
│  │                                  │  │  - Return { jobId, logs[] } │ │
│  └─────────────────────────────────┘  └──────────────────────────────┘
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              In-Memory Log Storage                                 │ │
│  │                                                                    │ │
│  │  Map<jobId, {                                                     │ │
│  │    jobId: string                                                 │ │
│  │    createdAt: timestamp                                          │ │
│  │    logs: [                                                       │ │
│  │      {                                                           │ │
│  │        timestamp: ISO8601,                                       │ │
│  │        level: "info|success|warning|error",                     │ │
│  │        message: string,                                         │ │
│  │        account?: string,                                        │ │
│  │        status?: string                                          │ │
│  │      }                                                           │ │
│  │    ]                                                             │ │
│  │  }>                                                              │ │
│  │                                                                    │ │
│  │  ← Auto-cleanup: Deletes entries older than 1 hour               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    │ GitHub Actions Dispatch Event
                    │ {
                    │   event_type: "trigger_ipo_bot",
                    │   client_payload: {
                    │     jobId: "job_xxx",
                    │     accounts: "[...]",
                    │     logsWebhookUrl: "https://app.com/api/logs",
                    │     resultsWebhookUrl: "https://app.com/api/results"
                    │   }
                    │ }
                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                                    │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Workflow File (.github/workflows/ipo-automation.yml)            │ │
│  │                                                                  │ │
│  │  on: repository_dispatch                                        │ │
│  │      types: [trigger_ipo_bot]                                  │ │
│  │                                                                  │ │
│  │  env:                                                           │ │
│  │    JOB_ID: ${{ github.event.client_payload.jobId }}            │ │
│  │    LOGS_WEBHOOK_URL: ${{ client_payload.logsWebhookUrl }}      │ │
│  │    ACCOUNTS_JSON: ${{ client_payload.accounts }}               │ │
│  │    RESULTS_WEBHOOK_URL: ${{ client_payload.resultsWebhookUrl}} │ │
│  │                                                                  │ │
│  │  steps:                                                         │ │
│  │    - checkout                                                   │ │
│  │    - setup python                                              │ │
│  │    - install playwright                                        │ │
│  │    - run: python scripts/apply.py  ← MAIN SCRIPT               │ │
│  │                                                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│                           ↓                                             │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Python Script (scripts/apply.py)                               │ │
│  │                                                                  │ │
│  │  JOB_ID = os.getenv('JOB_ID')                                  │ │
│  │  LOGS_WEBHOOK_URL = os.getenv('LOGS_WEBHOOK_URL')             │ │
│  │                                                                  │ │
│  │  async def send_log(level, message, account, status):          │ │
│  │      POST to LOGS_WEBHOOK_URL with:                            │ │
│  │        { jobId, level, message, account, status }              │ │
│  │                                                                  │ │
│  │  async def process_account(browser, account):                  │ │
│  │      - Send logs at each step                                  │ │
│  │      - Login → send_log("success", "Login successful")        │ │
│  │      - Navigate → send_log("info", "Navigated to ASBA")       │ │
│  │      - Fill form → send_log("info", "Form filled")            │ │
│  │      - Submit → send_log("success", "Application submitted")  │ │
│  │                                                                  │ │
│  │  async def main():                                             │ │
│  │      - Loop through accounts                                   │ │
│  │      - Call process_account() for each                         │ │
│  │      - Send logs at every step                                 │ │
│  │                                                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│                           ↓ POST /api/logs                              │
│                    (Webhook URLs)                                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    │ Log entries sent for each step:
                    │ { jobId, level, message, account, status }
                    │
                    ↓
         Backend /api/logs receives
                    │
                    ↓
         Stores in in-memory Map
                    │
                    ↓
    Frontend polls every 1 second
                    │
                    ↓
        LogsViewer displays logs
                    │
                    ↓
         User sees real-time progress! 🎉
```

---

## 🔄 Data Flow Diagram

### 1. User Initiation
```
┌──────────────────┐
│   User Uploads   │
│   CSV File       │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────┐
│  Frontend generates jobId:        │
│  job_1705424400123_abc123def     │
└────────┬─────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────┐
│  User clicks "Start IPO Application"                │
│  Frontend calls:                                    │
│  POST /api/dispatch                                │
│  { jobId, accounts }                               │
└────────┬────────────────────────────────────────────┘
         │
         ↓
```

### 2. Backend Processing
```
┌──────────────────────────────────────────────┐
│  /api/dispatch receives request              │
│  - Validates input                           │
│  - Builds GitHub dispatch payload with:      │
│    • jobId                                   │
│    • logsWebhookUrl                          │
│    • resultsWebhookUrl                       │
│    • accounts                                │
│  - Sends to GitHub API                       │
│  - Returns { jobId } to frontend             │
└────────┬─────────────────────────────────────┘
         │
         ↓
```

### 3. GitHub Actions Trigger
```
┌──────────────────────────────────────────────┐
│  GitHub receives dispatch event              │
│  - Parses client_payload                     │
│  - Sets environment variables:               │
│    • JOB_ID=job_1705424400123_abc123def     │
│    • LOGS_WEBHOOK_URL=https://...           │
│    • ACCOUNTS_JSON=[...]                     │
│  - Starts workflow                           │
│  - Runs: python scripts/apply.py             │
└────────┬─────────────────────────────────────┘
         │
         ↓
```

### 4. Python Script Execution
```
┌────────────────────────────────────────────┐
│  Python script starts                       │
│  JOB_ID = os.getenv('JOB_ID')              │
│  LOGS_WEBHOOK_URL = os.getenv('...')       │
│  Loop through accounts:                     │
│                                             │
│  For each account:                          │
│    1. await send_log("info", "Starting...")│
│       ↓ POST /api/logs                      │
│                                             │
│    2. Login to website                      │
│       await send_log("success", "Logged in")│
│       ↓ POST /api/logs                      │
│                                             │
│    3. Navigate to form                      │
│       await send_log("info", "Navigating")  │
│       ↓ POST /api/logs                      │
│                                             │
│    4. Fill form fields                      │
│       await send_log("info", "Filling form")│
│       ↓ POST /api/logs                      │
│                                             │
│    5. Submit application                    │
│       await send_log("success", "Submitted")│
│       ↓ POST /api/logs                      │
│                                             │
│    6. Logout                                │
│       await send_log("success", "Logged out")│
│       ↓ POST /api/logs                      │
│                                             │
└────────┬─────────────────────────────────────┘
         │
         ↓
```

### 5. Backend Receives Logs
```
┌──────────────────────────────────────────────┐
│  /api/logs POST endpoint:                   │
│  {                                          │
│    "jobId": "job_1705424400123_abc123def", │
│    "level": "success",                      │
│    "message": "Logged in successfully",     │
│    "account": "user@example.com",           │
│    "status": "logged_in"                    │
│  }                                          │
│                                             │
│  Stored in Map:                             │
│  {                                          │
│    "job_1705...": {                         │
│      logs: [                                │
│        { timestamp, level, message, ... },  │
│        { timestamp, level, message, ... },  │
│        ...                                  │
│      ]                                      │
│    }                                        │
│  }                                          │
└────────┬─────────────────────────────────────┘
         │
         ↓
```

### 6. Frontend Polling
```
┌───────────────────────────────────────────┐
│  Frontend starts polling (every 1 sec):    │
│  GET /api/logs?jobId=job_1705...         │
│                                           │
│  Response:                                │
│  {                                        │
│    "jobId": "job_1705...",               │
│    "logs": [                              │
│      {                                    │
│        "timestamp": "2024-01-16T14:32:45",│
│        "level": "info",                   │
│        "message": "Starting...",          │
│        "account": "user@example.com",     │
│        "status": "processing"             │
│      },                                   │
│      {                                    │
│        "timestamp": "2024-01-16T14:32:46",│
│        "level": "success",                │
│        "message": "Logged in",            │
│        "account": "user@example.com",     │
│        "status": "logged_in"              │
│      },                                   │
│      ...                                  │
│    ]                                      │
│  }                                        │
└────────┬──────────────────────────────────┘
         │
         ↓
```

### 7. Log Display
```
┌──────────────────────────────────────────┐
│  LogsViewer Component:                   │
│  - Updates state with new logs           │
│  - Re-renders with new data              │
│  - Auto-scrolls to bottom                │
│  - Color-codes by level                  │
│                                          │
│  Display:                                │
│  ┌────────────────────────────────────┐ │
│  │ [14:32:45] INFO  Starting...       │ │
│  │ [14:32:46] ✓ SUCCESS Logged in     │ │
│  │ [14:32:48] INFO  Navigating...     │ │
│  │ [14:32:50] ✓ SUCCESS Form filled   │ │
│  │ [14:32:55] ✓ SUCCESS Submitted     │ │
│  │ [14:32:56] ✓ SUCCESS Logged out    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  User sees: REAL-TIME PROGRESS! 🎉      │
└──────────────────────────────────────────┘
```

---

## 📊 Database Schema (In-Memory)

```
┌─────────────────────────────────────┐
│  logsStore (Map<string, JobLogs>)   │
└─────────────────────────────────────┘
            │
            ├─ key: "job_123"
            │  value: JobLogs {
            │    jobId: "job_123"
            │    createdAt: 1705424400123
            │    logs: [
            │      {
            │        timestamp: "2024-01-16T14:32:45.123Z"
            │        level: "info" | "success" | "warning" | "error"
            │        message: "Processing account"
            │        account: "user@example.com"
            │        status: "processing" | "logged_in" | "success" | "failed"
            │      },
            │      ...
            │    ]
            │  }
            │
            ├─ key: "job_456"
            │  value: JobLogs { ... }
            │
            └─ key: "job_789"
               value: JobLogs { ... }
```

---

## ⏱️ Timing Sequence

```
Time    Component        Action              Notes
────────────────────────────────────────────────────────────────
T+0     User            Clicks "Start"       Frontend generates jobId
T+50ms  Frontend        POST /api/dispatch   Sends accounts
T+100ms Backend         GitHub dispatch      Sends webhook URLs
T+200ms GitHub          Start workflow       Sets env vars
T+500ms Python          Starts processing    Begins account 1
T+1s    Python          send_log()           Login step
        └→ POST /api/logs                   Backend stores
        └→ Frontend polls /api/logs?jobId=XXX
        └→ LogsViewer updates               User sees "Login..." ✓
T+2s    Python          send_log()           Navigate step
        └→ POST /api/logs
        └→ Frontend sees new log            User sees "Navigating..." ✓
T+3s    Python          send_log()           Form filling
        └→ POST /api/logs
        └→ Frontend updates                 User sees "Filling form..." ✓
T+5s    Python          send_log()           Submit
        └→ POST /api/logs
        └→ Frontend updates                 User sees "Submitted!" ✓
T+6s    Python          send_log()           Logout
        └→ POST /api/logs
        └→ Frontend updates                 User sees "Done!" ✓
T+7s    Python          send_log()           Account 1 complete
        └→ POST /api/logs
        └→ Delay 5-10 seconds
T+12-17s Python         Account 2 starts     Repeat for next account
...     ...             ...                  ...
T+300s  Python          All done            send final results
        └→ Frontend done polling            User sees completion ✓
```

---

## 🔀 Message Flow Sequence Diagram

```
User                Frontend              Backend              GitHub Actions
  │                    │                    │                       │
  │ Click "Start"      │                    │                       │
  ├───────────────────→│                    │                       │
  │                    │ Generate jobId     │                       │
  │                    │ (job_1234567890)   │                       │
  │                    │                    │                       │
  │                    │ POST /api/dispatch │                       │
  │                    ├───────────────────→│                       │
  │                    │                    │ Build dispatch event   │
  │                    │                    │ + webhook URLs        │
  │                    │                    │                       │
  │                    │                    │ POST /api/dispatches  │
  │                    │                    ├──────────────────────→│
  │                    │                    │                       │
  │                    │ Return { jobId }   │                       │
  │                    │←───────────────────┤                       │
  │                    │                    │                       │
  │ See LogsViewer     │                    │                       │
  │←───────────────────┤                    │                       │
  │                    │                    │                       │
  │                    │ Polls /api/logs    │                       │
  │                    ├───────────────────→│ Return empty logs     │
  │                    │←───────────────────┤                       │
  │                    │                    │                       │
  │                    │                    │                       │ Start workflow
  │                    │                    │ ←──────────────────  │
  │                    │                    │ Set env vars          │
  │                    │                    │ Run apply.py          │
  │                    │                    │                       │
  │                    │                    │                       │ send_log("Starting...")
  │                    │                    │ POST /api/logs       │
  │                    │                    │←──────────────────  │
  │                    │                    │ Store in memory       │
  │                    │                    │                       │
  │                    │ Polls /api/logs    │                       │
  │                    ├───────────────────→│                       │
  │                    │ [First log entry]  │                       │
  │                    │←───────────────────┤                       │
  │                    │                    │                       │
  │ See "Starting..."  │                    │                       │
  │←───────────────────┤                    │                       │
  │                    │                    │                       │
  │                    │                    │                       │ send_log("Login success")
  │                    │                    │ POST /api/logs       │
  │                    │                    │←──────────────────  │
  │                    │                    │ Store in memory       │
  │                    │                    │                       │
  │                    │ Polls /api/logs    │                       │
  │                    ├───────────────────→│                       │
  │                    │ [Updated logs]     │                       │
  │                    │←───────────────────┤                       │
  │                    │                    │                       │
  │ See "Login ok"     │                    │                       │
  │←───────────────────┤                    │                       │
  │                    │                    │                       │
  │                    │ ... polling continues ...                   │
  │                    │                    │                       │
  │ Sees all steps     │                    │                       │
  │ in real-time!      │                    │                       │
  │                    │                    │                       │ send final results
  │                    │                    │ POST /api/results    │
  │                    │                    │←──────────────────  │
```

---

## 🎯 Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React App                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DashboardPage                                       │  │
│  │  - useState([accounts])                              │  │
│  │  - useState(isProcessing)                            │  │
│  │  - useState(jobId)                                   │  │
│  │                                                      │  │
│  │  ┌────────────────────┐  ┌───────────────────────┐  │  │
│  │  │ CSVUploadArea      │  │ ProcessingStatus      │  │  │
│  │  │ ↓ onFileUpload()   │  │ ← accountsCount       │  │  │
│  │  │ ↓ setAccounts()    │  │ ← isProcessing        │  │  │
│  │  └────────────────────┘  │ ← status              │  │  │
│  │                          │ Click → startProcess()│  │  │
│  │  ┌────────────────────┐  └───────────────────────┘  │  │
│  │  │ AccountsTable      │                             │  │
│  │  │ ← accounts         │                             │  │
│  │  │ Display list       │                             │  │
│  │  └────────────────────┘                             │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │ startProcess()                                 │ │  │
│  │  │ 1. Generate jobId                             │ │  │
│  │  │    job_${Date.now()}_${random}               │ │  │
│  │  │ 2. POST /api/dispatch                        │ │  │
│  │  │    { jobId, accounts }                       │ │  │
│  │  │ 3. Receive { jobId } in response             │ │  │
│  │  │ 4. setJobId(jobId)                           │ │  │
│  │  │ 5. Set isProcessing = true                   │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │  {jobId && (                                        │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │ LogsViewer                                  │    │  │
│  │  │ ← jobId                                     │    │  │
│  │  │                                             │    │  │
│  │  │ useEffect(() => {                           │    │  │
│  │  │   fetchLogs()  // Initial fetch             │    │  │
│  │  │   setInterval(fetchLogs, 1000)  // Poll     │    │  │
│  │  │ }, [jobId])                                 │    │  │
│  │  │                                             │    │  │
│  │  │ fetchLogs():                                │    │  │
│  │  │ GET /api/logs?jobId=${jobId}               │    │  │
│  │  │ ↓ Response: { logs: [] }                    │    │  │
│  │  │ ↓ setLogs(data.logs)                        │    │  │
│  │  │                                             │    │  │
│  │  │ Render:                                      │    │  │
│  │  │ • Logscontainer (auto-scroll)               │    │  │
│  │  │ • Map logs with color-coding                │    │  │
│  │  │ • Show timestamp, level, message, account   │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │  )}                                                  │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           ↕ HTTP Calls
    ┌──────────────────────────────────────┐
    │  Next.js API Routes                  │
    │  • /api/dispatch                     │
    │  • /api/logs                         │
    └──────────────────────────────────────┘
           ↕ GitHub Dispatch Event
    ┌──────────────────────────────────────┐
    │  GitHub Actions                      │
    │  • Run apply.py                      │
    │  • Set env vars                      │
    │  • Send logs via POST /api/logs      │
    └──────────────────────────────────────┘
```

---

That's the complete architecture! The system is elegant, scalable, and user-friendly.
