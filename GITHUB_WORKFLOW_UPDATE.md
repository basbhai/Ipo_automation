# GitHub Actions Workflow Update Required

## Update Your `.github/workflows/ipo-automation.yml`

Replace your workflow file with this template that includes the logging webhook URLs:

```yaml
name: IPO Automation Workflow

on:
  repository_dispatch:
    types: [trigger_ipo_bot]

jobs:
  run-ipo-automation:
    runs-on: ubuntu-latest
    
    env:
      # These come from the dispatch event
      JOB_ID: ${{ github.event.client_payload.jobId }}
      LOGS_WEBHOOK_URL: ${{ github.event.client_payload.logsWebhookUrl }}
      ACCOUNTS_JSON: ${{ github.event.client_payload.accounts }}
      RESULTS_WEBHOOK_URL: ${{ github.event.client_payload.resultsWebhookUrl }}
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Dependencies
        run: |
          pip install playwright aiohttp
          playwright install chromium
      
      - name: Run IPO Automation Script
        run: |
          python scripts/apply.py
        env:
          JOB_ID: ${{ github.event.client_payload.jobId }}
          LOGS_WEBHOOK_URL: ${{ github.event.client_payload.logsWebhookUrl }}
          ACCOUNTS_JSON: ${{ github.event.client_payload.accounts }}
          RESULTS_WEBHOOK_URL: ${{ github.event.client_payload.resultsWebhookUrl }}
      
      - name: Upload Logs (Optional)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: automation-logs-${{ github.event.client_payload.jobId }}
          path: |
            *.log
            logs/
          retention-days: 7
```

## Key Changes Made

### 1. **Environment Variables**
All three webhook URLs are now passed from the frontend dispatch:
- `JOB_ID`: Unique identifier for tracking this run
- `LOGS_WEBHOOK_URL`: Where to send real-time logs
- `RESULTS_WEBHOOK_URL`: Where to send final results
- `ACCOUNTS_JSON`: The account data to process

### 2. **Explicit Environment Setup**
The step explicitly sets all environment variables so Python script can access them via `os.getenv()`

### 3. **Optional: Artifact Upload**
Added optional artifact upload to save logs from GitHub Actions itself (different from webhook logs)

## How the Python Script Uses These Variables

Inside `scripts/apply.py`:

```python
# Get environment variables
JOB_ID = os.getenv('JOB_ID', 'unknown')
LOGS_WEBHOOK_URL = os.getenv('LOGS_WEBHOOK_URL', '')

# Send logs while processing
await send_log("info", "Step: Opening DP dropdown...", account=username)
await send_log("success", "Login successful", account=username, status="logged_in")
await send_log("error", "Failed to find IPO", account=username, status="failed")
```

Each call to `send_log()` will POST to `LOGS_WEBHOOK_URL` with the job ID and log details.

## Testing the Workflow

1. **Manually trigger from Actions UI:**
   - Go to GitHub → Actions → IPO Automation Workflow
   - Click "Run workflow" 
   - Provide test payload (optional, will use defaults)

2. **Trigger via curl (for testing):**
```bash
curl -X POST \
  https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/dispatches \
  -H "Authorization: token YOUR_GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "event_type": "trigger_ipo_bot",
    "client_payload": {
      "jobId": "test_manual_1",
      "accounts": "[{\"dp\":\"ASBA-123\",\"username\":\"test@example.com\",\"password\":\"pass\",\"pin\":\"1234\",\"crn\":\"1234567890\",\"units\":\"100\"}]",
      "logsWebhookUrl": "https://your-app.com/api/logs",
      "resultsWebhookUrl": "https://your-app.com/api/results"
    }
  }'
```

3. **Via the frontend UI:**
   - Upload CSV
   - Click "Start IPO Application"
   - Frontend sends dispatch event automatically

## Troubleshooting

### "LOGS_WEBHOOK_URL is not set"
- Check that the dispatch event is including `logsWebhookUrl` in `client_payload`
- Verify environment variables are correctly mapped in workflow

### "Failed to send log to webhook"
- Check that your frontend URL is publicly accessible
- Verify the `/api/logs` endpoint is working: `curl https://your-app.com/api/logs?jobId=test`
- Check GitHub Actions logs for the actual error

### "Logs not appearing in frontend"
- Ensure frontend has correct jobId (check browser console)
- Verify `/api/logs?jobId=XXX` returns data
- Check browser DevTools Network tab for polling requests

## Variables Passed from Frontend

When you click "Start IPO Application", the frontend sends this to GitHub:

```typescript
{
  event_type: "trigger_ipo_bot",
  client_payload: {
    accounts: "[{\"dp\":\"...\", \"username\":\"...\", ...}]",  // JSON string
    jobId: "job_1705424400123_abc123def",                         // Unique ID
    logsWebhookUrl: "https://your-app.vercel.app/api/logs",      // For real-time logs
    resultsWebhookUrl: "https://your-app.vercel.app/api/results" // For final results
  }
}
```

The Python script reads these from environment variables set by the workflow.

---

**Next Step**: Update your `.github/workflows/ipo-automation.yml` with the template above, then test!
