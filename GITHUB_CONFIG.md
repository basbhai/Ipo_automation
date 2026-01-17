# GitHub Configuration Guide

## Required Environment Variables

You need to set these variables in your Vercel project:

### 1. GITHUB_PAT (Personal Access Token)
- Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
- Create a new token with these scopes:
  - `repo` (full control of private repositories)
  - `workflow` (manage GitHub Actions)
- Copy the token and set it in Vercel as `GITHUB_PAT`

### 2. GITHUB_REPO
- **Format:** `owner/repo` (e.g., `basbhai/Ipo_automation`)
- **Do NOT include:**
  - ❌ `https://github.com/basbhai/Ipo_automation`
  - ❌ `https://github.com/basbhai/Ipo_automation.git`
  - ❌ `git@github.com:basbhai/Ipo_automation.git`
- **Correct format:**
  - ✅ `basbhai/Ipo_automation`

## Setting Variables in Vercel

1. Go to your project settings in Vercel
2. Click on "Environment Variables"
3. Add:
   - Name: `GITHUB_PAT` → Value: Your GitHub personal access token
   - Name: `GITHUB_REPO` → Value: `basbhai/Ipo_automation`
4. Deploy/redeploy your project

## Troubleshooting

If you see an error like:
```
fetch to https://api.github.com/repos/https://dispatches failed with status 404
```

This means `GITHUB_REPO` is set incorrectly. Make sure it's in the format `owner/repo`, not a URL.

## Verifying Your Configuration

1. Go to your Vercel project settings
2. Check the "Environment Variables" section
3. Verify:
   - `GITHUB_PAT` is set and not empty
   - `GITHUB_REPO` is exactly `basbhai/Ipo_automation` (no URL, no `.git` suffix)
