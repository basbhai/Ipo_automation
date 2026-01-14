# Mero Share IPO Automator - Setup Guide

## Prerequisites

- Python 3.8+
- pip (Python package manager)

## Installation

### Step 1: Install Dependencies

Run the setup script to install all required packages and Playwright browsers:

```bash
bash scripts/setup.sh
```

Or manually:

```bash
pip install -r scripts/requirements.txt
playwright install chromium
```

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory with:

```env
GITHUB_PAT=your_github_personal_access_token
GITHUB_REPO=your_username/your_repo
BROWSERLESS_TOKEN=optional_browserless_token
```

Or set them as system environment variables:

```bash
export GITHUB_PAT="your_token"
export GITHUB_REPO="your_username/your_repo"
export BROWSERLESS_TOKEN="optional_token"
```

### Step 3: Run the Automation

The automation is triggered via GitHub Actions. Use the dashboard:

1. Navigate to the app at `http://localhost:3000` (after running `npm run dev`)
2. Upload a CSV file with columns: `dp, username, password, pin, crn, units`
3. Click "Submit" to trigger the automation

## CSV Format

Create a CSV file with the following headers:

```csv
dp,username,password,pin,crn,units
ASBA-123456,user@example.com,password123,1234,1234567890123456,100
ASBA-234567,user2@example.com,password456,5678,1234567890123457,200
```

### Column Descriptions

- **dp**: Bank DP code (e.g., ASBA-123456)
- **username**: Mero Share login username/email
- **password**: Mero Share password
- **pin**: ASBA PIN
- **crn**: Citizen Registration Number
- **units**: Number of units (Kitta) to apply for

## Troubleshooting

### Playwright Installation Issues

If you get "Playwright not installed" error:

```bash
pip install --upgrade playwright
playwright install chromium
```

### Browserless Token

If using Browserless.io for remote browser execution:

1. Sign up at https://www.browserless.io
2. Get your API token from the dashboard
3. Add it to `BROWSERLESS_TOKEN` environment variable

### Select2 Dropdown Issues

The automation includes dedicated handling for Mero Share's Select2 dropdowns for the DP (Bank) field. If you encounter issues:

1. Check that the DP value matches exactly what appears in the dropdown
2. Ensure proper formatting (usually in format like "ASBA-XXXXXX")
3. Review logs for "fill_dp_field_with_select2" output

## Running Locally

To test the script locally:

```bash
export ACCOUNTS_JSON='[{"dp":"ASBA-123456","username":"user@example.com","password":"pass","pin":"1234","crn":"1234567890123456","units":100}]'
python scripts/apply.py
```

## Security Notes

- Never commit `.env` files with real credentials
- GitHub Actions automatically masks sensitive data in logs
- Each account runs in an isolated browser context
- Passwords are never stored—they're passed only at runtime
