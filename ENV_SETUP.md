# Environment Variables Setup Guide

## Required Variables

### GitHub Configuration
1. **GITHUB_REPO** - Your GitHub repository for the workflow
   - Format: `owner/repo` (e.g., `myusername/mero-share-automator`)
   - Example: `john-doe/mero-ipo-bot`
   - DO NOT include `https://`, just the owner and repo name

2. **GITHUB_PAT** - GitHub Personal Access Token
   - Create at: https://github.com/settings/tokens
   - Required Scopes: `repo` (full control of private repositories)
   - Never share this token

### Application
3. **NEXT_PUBLIC_APP_NAME** - Display name for the application
   - Example: `Mero Share IPO Automator`

## Common Issues & Fixes

### 404 Error When Dispatching
**Error:** `fetch to https://api.github.com/repos/https://dispatches failed with status 404`

**Cause:** `GITHUB_REPO` is set to an invalid value like `https://dispatches` instead of `owner/repo`

**Solution:** 
- Update `GITHUB_REPO` to format: `owner/repo`
- Example: If your repo is at `https://github.com/myusername/mero-bot`, set `GITHUB_REPO=myusername/mero-bot`

### 401 Unauthorized
**Cause:** `GITHUB_PAT` is missing, expired, or has insufficient permissions

**Solution:**
- Verify the token hasn't expired
- Check that it has `repo` scope
- Create a new token if needed at https://github.com/settings/tokens

### 403 Forbidden
**Cause:** Token exists but doesn't have necessary permissions

**Solution:**
- Regenerate the token with `repo` (full control) scope
- Ensure the token isn't restricted to specific repositories (unless needed)

## Setting Up Variables in v0

1. Click the **Vars** button in the left sidebar
2. Add each variable:
   - `GITHUB_REPO` → your-username/your-repo
   - `GITHUB_PAT` → your-github-token
   - `NEXT_PUBLIC_APP_NAME` → Mero Share IPO Automator
3. Click Save
4. Refresh the app

## Testing the Configuration

1. Upload a test CSV with one account
2. Click "Start IPO Process"
3. Check for error messages - they'll indicate what's misconfigured
4. Visit GitHub Actions in your repo to verify the workflow triggered
