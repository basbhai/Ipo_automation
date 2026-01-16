# Real-Time Logging - Quick Start Guide

## 🎯 What You Asked For
Show all GitHub Actions logger details in the frontend in real-time.

## ✅ What's Been Implemented

### Frontend
- ✅ **LogsViewer Component**: Beautiful real-time log display with:
  - Color-coded log levels (success, error, warning, info)
  - Account names and status tags
  - Auto-scroll to latest logs
  - Timestamps for each entry
  - Live polling every 1 second

- ✅ **Main Page Updates**: 
  - Generates unique jobId
  - Passes jobId to backend
  - Shows LogsViewer when processing
  - Receives jobId in response

### Backend
- ✅ **`/api/logs` Endpoint**: 
  - `POST` - Receive log entries from Python script
  - `GET` - Retrieve logs by jobId
  - In-memory storage with auto-cleanup

- ✅ **`/api/dispatch` Updates**:
  - Now includes `logsWebhookUrl` in GitHub dispatch payload
  - Returns `jobId` for frontend tracking

### Python Script
- ✅ **`send_log()` Function**: Sends logs to webhook URL
- ✅ **Logging at Every Step**: 
  - Login attempts
  - Form submissions
  - Page navigation
  - Success/failure states
  - Error details

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LogsViewer Component                                │  │
│  │  • Polls /api/logs every 1 second                   │  │
│  │  • Displays logs with color coding                  │  │
│  │  • Auto-scrolls to latest                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ (jobId: "job_xxx")
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Next.js)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/logs (POST/GET)                               │  │
│  │  • Receives logs from Python script                 │  │
│  │  • Stores in memory                                 │  │
│  │  • Returns logs to frontend                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/dispatch                                       │  │
│  │  • Generates jobId                                  │  │
│  │  • Sends GitHub Actions dispatch event              │  │
│  │  • Includes webhook URLs                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions (Workflow)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  runs: scripts/apply.py                              │  │
│  │  • Reads JOB_ID from env                            │  │
│  │  • Reads LOGS_WEBHOOK_URL from env                  │  │
│  │  • Sends logs at each step                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 How to Use

### Step 1: Update GitHub Workflow
Update `.github/workflows/ipo-automation.yml` to include:
```yaml
env:
  JOB_ID: ${{ github.event.client_payload.jobId }}
  LOGS_WEBHOOK_URL: ${{ github.event.client_payload.logsWebhookUrl }}
  ACCOUNTS_JSON: ${{ github.event.client_payload.accounts }}
  RESULTS_WEBHOOK_URL: ${{ github.event.client_payload.resultsWebhookUrl }}
```

See `GITHUB_WORKFLOW_UPDATE.md` for complete template.

### Step 2: Deploy Frontend
```bash
# Install any new dependencies (should be none - already have aiohttp)
npm install

# Build and deploy to Vercel
vercel deploy
```

### Step 3: Test It
1. Go to your frontend
2. Upload CSV with accounts
3. Click "Start IPO Application"
4. Watch logs appear in real-time! 🎉

## 📝 What Logs Look Like

```
[14:32:45] INFO     Starting account processing (processing)
[14:32:46] SUCCESS  DP ASBA-123 selected
[14:32:50] INFO     Step: Opening DP dropdown...
[14:32:52] SUCCESS  Login successful (logged_in)
[14:33:02] ERROR    Critical error: Element not found
```

## 🔍 Files Changed

### New Files
- ✅ `/app/api/logs/route.ts` - Logging endpoint
- ✅ `/components/logs-viewer.tsx` - Log display component
- ✅ `/LOGGING_IMPLEMENTATION.md` - Full documentation
- ✅ `/GITHUB_WORKFLOW_UPDATE.md` - Workflow update guide

### Modified Files
- ✅ `/app/page.tsx` - Added LogsViewer, jobId generation
- ✅ `/app/api/dispatch/route.ts` - Added logsWebhookUrl in dispatch
- ✅ `/scripts/apply.py` - Added send_log() function and calls

## ⚙️ Configuration

No additional configuration needed! Everything is:
- ✅ Automated
- ✅ Self-contained
- ✅ Backward compatible

## 🔗 API Reference

### POST /api/logs
```bash
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_123",
    "level": "info",
    "message": "Processing account",
    "account": "user@example.com",
    "status": "processing"
  }'
```

### GET /api/logs
```bash
curl http://localhost:3000/api/logs?jobId=job_123
```

Response:
```json
{
  "jobId": "job_123",
  "createdAt": 1705424400123,
  "logs": [
    {
      "timestamp": "2024-01-16T14:32:45.123Z",
      "level": "info",
      "message": "Starting account processing",
      "account": "user@example.com",
      "status": "processing"
    },
    ...
  ]
}
```

## 🧪 Test Locally

```bash
# Terminal 1: Run Next.js dev server
npm run dev

# Terminal 2: Test logs endpoint
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test_job","level":"info","message":"Test log","account":"test@example.com"}'

# Terminal 3: Retrieve logs
curl http://localhost:3000/api/logs?jobId=test_job
```

Then visit `http://localhost:3000` and watch logs appear (though without GitHub Actions, they'll only be from manual POST).

## ✅ Checklist

- [ ] Read `GITHUB_WORKFLOW_UPDATE.md`
- [ ] Update `.github/workflows/ipo-automation.yml` with template
- [ ] Deploy frontend changes (`git push` / `vercel deploy`)
- [ ] Test with CSV upload
- [ ] Watch logs appear in real-time!
- [ ] Celebrate! 🎉

## 📞 Troubleshooting

| Problem | Solution |
|---------|----------|
| Logs not appearing | Check jobId in browser console, verify `/api/logs?jobId=XXX` returns data |
| Webhook URL error | Ensure frontend URL is public and `/api/logs` endpoint exists |
| GitHub dispatch failing | Check `GITHUB_PAT` has `repo` scope, verify `GITHUB_REPO` is correct |
| Python script not sending logs | Verify `LOGS_WEBHOOK_URL` env var is set in workflow |

---

**Status**: 🟢 Ready to use! Just update your GitHub Actions workflow file and deploy.
