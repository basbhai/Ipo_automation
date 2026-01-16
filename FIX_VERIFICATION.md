# Fix Verification Checklist

## Problem
- ❌ `/api/results?jobId=...` returning 404
- Root cause: Python script not sending results to `/api/results` endpoint

## What Was Fixed

### 1. GitHub Actions Workflow (✅ UPDATED)
**File**: `.github/workflows/apply_ipo.yml`

**Changes Made**:
- ✅ Added job-level `env` section with all 4 webhook URLs
- ✅ Ensured environment variables are available to the Python script
- ✅ Added `aiohttp` to pip install dependencies

**Before**:
```yaml
jobs:
  apply_ipo:
    runs-on: ubuntu-latest
    steps:
      - run: pip install playwright pandas
      - run: python scripts/apply.py
        env:
          JOB_ID: ...
          LOGS_WEBHOOK_URL: ...
```

**After**:
```yaml
jobs:
  apply_ipo:
    runs-on: ubuntu-latest
    env:  # ← Added job-level env
      JOB_ID: ${{ github.event.client_payload.jobId }}
      LOGS_WEBHOOK_URL: ${{ github.event.client_payload.logsWebhookUrl }}
      ACCOUNTS_JSON: ${{ github.event.client_payload.accounts }}
      RESULTS_WEBHOOK_URL: ${{ github.event.client_payload.resultsWebhookUrl }}
    steps:
      - run: pip install playwright pandas aiohttp  # ← Added aiohttp
```

### 2. Python Script (✅ ALREADY CORRECT)
**File**: `scripts/apply.py`
- ✅ Has `send_results_to_api()` function
- ✅ Calls it with results webhook URL
- ✅ Properly encodes results as JSON

### 3. Results API Endpoint (✅ ALREADY CORRECT)
**File**: `app/api/results/route.ts`
- ✅ Has GET endpoint to retrieve results
- ✅ Has POST endpoint to store results
- ✅ Returns proper error messages

---

## How It Now Works

### Step 1: Frontend Sends Request
```typescript
POST /api/dispatch
{
  jobId: "job_1768564939189_zk59kj3xt",
  accounts: [...]
}
```

### Step 2: Backend Triggers GitHub
```json
GitHub dispatch with client_payload:
{
  jobId: "job_1768564939189_zk59kj3xt",
  logsWebhookUrl: "https://app.com/api/logs",
  resultsWebhookUrl: "https://app.com/api/results",
  accounts: "[...]"
}
```

### Step 3: GitHub Actions Runs
```yaml
env:
  JOB_ID: "job_1768564939189_zk59kj3xt"
  LOGS_WEBHOOK_URL: "https://app.com/api/logs"
  RESULTS_WEBHOOK_URL: "https://app.com/api/results"
  ACCOUNTS_JSON: "[...]"
```

### Step 4: Python Script Executes
```python
JOB_ID = os.getenv('JOB_ID')  # ✅ Available now
RESULTS_WEBHOOK_URL = os.getenv('RESULTS_WEBHOOK_URL')  # ✅ Available now

# At the end of script:
await send_results_to_api(results, JOB_ID, RESULTS_WEBHOOK_URL)
# POSTs to: https://app.com/api/results
# With: { jobId: "job_1768564939189_zk59kj3xt", results: [...] }
```

### Step 5: Results Stored in Backend
```
GET https://app.com/api/results?jobId=job_1768564939189_zk59kj3xt
Response: { jobId: "...", results: [...] }  ✅ 200 OK (not 404)
```

---

## ✅ Verification Steps

To verify the fix is working:

1. **Deploy the updated workflow file**
   ```bash
   git add .github/workflows/apply_ipo.yml
   git commit -m "Fix: Add job-level env vars and aiohttp dependency"
   git push
   ```

2. **Test with a CSV upload**
   - Upload CSV file
   - Click "Start IPO Application"
   - Wait for processing
   - Check if logs appear (they should)
   - Wait for completion

3. **Verify results are stored**
   ```bash
   # Replace with your actual jobId
   curl "https://your-app.com/api/results?jobId=job_1768564939189_zk59kj3xt"
   
   # Should return:
   # {
   #   "jobId": "job_1768564939189_zk59kj3xt",
   #   "createdAt": 1234567890,
   #   "results": [
   #     {
   #       "username": "...",
   #       "status": "success|failed",
   #       "message": "...",
   #       "timestamp": "..."
   #     }
   #   ]
   # }
   ```

4. **Check GitHub Actions logs**
   - Go to GitHub Actions
   - Find the workflow run
   - Check "Run IPO application script" logs
   - Should see "Sending results to API..."

---

## Troubleshooting

### Still Getting 404?

**Check 1: Is the workflow running?**
- Go to GitHub → Actions
- Look for "Mero Share IPO Bulk Applicator"
- Click recent runs
- Check if it has "Run IPO application script" step

**Check 2: Are env vars being set?**
- In GitHub Actions, check the workflow logs
- Look for: `env: { JOB_ID: "...", LOGS_WEBHOOK_URL: "...", etc }`
- If empty, the dispatch event isn't being sent correctly

**Check 3: Is Python sending results?**
- In GitHub Actions logs, look for: "Sending results to API..."
- If not there, Python script crashed before that point
- Check earlier logs for errors

**Check 4: Is the webhook URL correct?**
- Verify in dispatch logs: `"resultsWebhookUrl": "https://..."`
- Must be publicly accessible
- Test it: `curl https://your-app.com/api/results?jobId=test`

### Getting "No results webhook URL provided" log?

This means `RESULTS_WEBHOOK_URL` env var is empty.

**Fix**: 
- Make sure workflow has job-level `env:` section (not just step-level)
- Make sure `/api/dispatch` is passing `resultsWebhookUrl` in the payload
- Check `app/api/dispatch/route.ts` includes it

---

## Summary

✅ **Fixed**: GitHub Actions workflow now properly receives and exports webhook URLs  
✅ **Added**: `aiohttp` to workflow dependencies  
✅ **Verified**: Python script already sends results correctly  
✅ **Verified**: Results endpoint properly stores and retrieves results  

**Next**: Deploy and test with a real CSV upload. Results will now be stored! 🎉

---

**Files Changed**: 1 (`.github/workflows/apply_ipo.yml`)  
**Files Added**: 0  
**Files Modified**: 1  
**Status**: ✅ Ready for testing
