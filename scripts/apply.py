import asyncio
import json
import os
import sys
import random
import logging
import aiohttp
from datetime import datetime

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed.")
    sys.exit(1)

# Global variables for webhook logging
JOB_ID = os.getenv('JOB_ID', 'unknown')
LOGS_WEBHOOK_URL = os.getenv('LOGS_WEBHOOK_URL', '')

async def send_log(level: str, message: str, account: str = None, status: str = None):
    """Send a log entry to the API webhook."""
    if not LOGS_WEBHOOK_URL:
        return
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "jobId": JOB_ID,
                "level": level,
                "message": message,
                "account": account,
                "status": status
            }
            async with session.post(LOGS_WEBHOOK_URL, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning(f"Failed to send log to webhook: HTTP {resp.status}")
    except Exception as e:
        logger.warning(f"Error sending log to webhook: {str(e)}")

async def handle_logout(page):
    """Handles the logout process using the provided DOM structure."""
    try:
        logger.info("Step: Attempting to logout...")
        await send_log("info", "Step: Attempting to logout...")
        
        # Targeting the desktop logout link specifically
        logout_selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        
        await page.wait_for_selector(logout_selector, timeout=5000)
        await page.click(logout_selector)
        
        # Wait for the URL to return to the login page to confirm logout
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Successfully logged out.")
        await send_log("success", "Successfully logged out.")
        return True
    except Exception as e:
        logger.warning(f"Logout failed or timed out (might already be logged out): {str(e)}")
        return False

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the LOGIN page."""
    try:
        logger.info(f"Step: Opening DP dropdown to search for {bank_code}...")
        await send_log("info", f"Step: Opening DP dropdown to search for {bank_code}...")
        
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000) 
        
        option_locator = page.locator(f"li.select2-results__option:has-text('({bank_code})')")
        
        if await option_locator.is_visible():
            await option_locator.click()
            logger.info(f"SUCCESS: DP {bank_code} selected.")
            await send_log("success", f"DP {bank_code} selected.")
            return True
        else:
            logger.error(f"FAIL: Could not find DP result for code {bank_code}.")
            await send_log("error", f"Could not find DP result for code {bank_code}.")
            return False
    except Exception as e:
        logger.error(f"EXCEPTION selecting DP: {str(e)}")
        await send_log("error", f"Exception selecting DP: {str(e)}")
        return False

async def process_account(browser, account):
    context = None
    username = account.get('username', 'unknown')
    
    try:
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login
        logger.info(f"--- Starting Account: {username} ---")
        await send_log("info", f"Starting account processing", account=username, status="processing")
        
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        
        if not await select_login_dp(page, account['dp']):
            await send_log("error", f"Failed to select DP {account['dp']}", account=username, status="failed")
            return {
                "username": username,
                "status": "failed",
                "message": f"Failed to select DP {account['dp']}"
            }

        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful!")
        await send_log("success", "Login successful", account=username, status="logged_in")

        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await send_log("info", "Navigated to ASBA page", account=username)

        # 3. Find Ordinary Share & Click Apply
        ipo_row = page.locator(".company-list", has=page.locator("span.isin", has_text="Ordinary Shares")).first
        
        # Check if IPO row exists
        if not await ipo_row.is_visible():
            await send_log("error", "No active Ordinary Shares found", account=username, status="failed")
            await handle_logout(page)
            return {
                "username": username,
                "status": "failed",
                "message": "No active Ordinary Shares found"
            }

        # Define locators for both buttons
        apply_btn = ipo_row.locator("button.btn-issue:has-text('Apply')")
        edit_btn = ipo_row.locator("button.btn-issue:has-text('Edit')")

        if await apply_btn.is_visible():
            await send_log("info", "Found Apply button, opening form", account=username)
            await apply_btn.click()
            logger.info("SUCCESS: Apply form opened.")
            await send_log("success", "Apply form opened", account=username)
        elif await edit_btn.is_visible():
            logger.info("SKIP: IPO already applied for this account (found 'Edit' button).")
            await send_log("success", "IPO already applied (Edit button found)", account=username, status="success")
            await handle_logout(page)
            return {
                "username": username,
                "status": "success",
                "message": "IPO already applied (Edit button found)"
            }
        else:
            logger.warning("FAIL: Found 'Ordinary Shares' but neither 'Apply' nor 'Edit' buttons are visible.")
            await send_log("error", "Apply/Edit buttons not visible", account=username, status="failed")
            await handle_logout(page)
            return {
                "username": username,
                "status": "failed",
                "message": "Apply/Edit buttons not visible"
            }

        # 4. Wizard Step 1: Form Filling
        await page.wait_for_selector("#selectBank", state="visible")
        await send_log("info", "Filling IPO application form", account=username)
        
        await page.select_option("#selectBank", index=1)
        
        await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
        await page.select_option("#accountNumber", index=1)
        
        await page.wait_for_timeout(1000)
        branch = await page.input_value("#selectBranch")
        logger.info(f"Step: Bank selected. Branch detected: {branch}")
        await send_log("info", f"Bank selected. Branch: {branch}", account=username)

        await page.fill("#appliedKitta", str(account['units']))
        await page.focus("#appliedKitta")
        await page.keyboard.press("Tab") 
        await page.locator("#appliedKitta").dispatch_event("blur")
        
        await page.wait_for_timeout(1000)
        amount = await page.input_value("#amount")
        logger.info(f"Step: Units {account['units']} entered. Total Amount: NPR {amount}")
        await send_log("info", f"Units {account['units']} entered. Total Amount: NPR {amount}", account=username)

        await page.fill("#crnNumber", str(account['crn']))
        await page.check("#disclaimer", force=True)
        
        await send_log("info", "Submitting form", account=username)
        await page.click("button[type='submit']:has-text('Proceed')")

        # 5. Wait for PIN page
        await page.wait_for_selector("#pinCode", timeout=30000)
        logger.info("Step: PIN input page reached.")
        await send_log("info", "PIN input page reached", account=username)

        await page.fill("#pinCode", str(account['pin']))
        await page.click("button[type='submit']:has-text('Submit')")

        # 6. Success confirmation
        await page.wait_for_timeout(5000)
        logger.info("✅ IPO Application Successfully Submitted!")
        await send_log("success", "IPO Application Successfully Submitted!", account=username, status="success")

        # 7. Logout
        await handle_logout(page)

        return {
            "username": username,
            "status": "success",
            "message": "IPO successfully applied"
        }

    except Exception as e:
        logger.error(f"CRITICAL ERROR for {username}: {str(e)}")
        await send_log("error", f"Critical error: {str(e)}", account=username, status="failed")
        return {
            "username": username,
            "status": "failed",
            "message": f"Error: {str(e)}"
        }
    finally:
        if context:
            await context.close()
async def send_results_to_api(results, job_id, webhook_url):
    """Send results back to the API endpoint."""
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "jobId": job_id,
                "results": results
            }
            async with session.post(webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    logger.info(f"Results successfully sent to API for jobId: {job_id}")
                else:
                    logger.error(f"Failed to send results: HTTP {resp.status}")
    except Exception as e:
        logger.error(f"Error sending results to API: {str(e)}")

async def main():
    try:
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        results_webhook_url = os.getenv('RESULTS_WEBHOOK_URL', '')
        
        accounts = json.loads(accounts_json)
        results = []

        logger.info(f"Processing {len(accounts)} account(s)...")
        await send_log("info", f"Processing {len(accounts)} account(s)...", status="started")

        async with async_playwright() as p:
            logger.info("Launching local Chromium...")
            await send_log("info", "Launching Chromium browser", status="browser_starting")
            
            # Launch local browser in headless mode
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"]
            )
            
            try:
                for idx, account in enumerate(accounts, 1):
                    logger.info(f"Processing account {idx}/{len(accounts)}: {account.get('username')}")
                    result = await process_account(browser, account)
                    results.append({
                        **result,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Gentle delay between accounts
                    if idx < len(accounts):
                        await send_log("info", f"Waiting before next account...", status="delay")
                        await asyncio.sleep(random.uniform(5, 10))
            finally:
                await browser.close()
                await send_log("info", "Browser closed", status="browser_closed")
        
        # Send results back to the API if webhook URL is provided
        if results_webhook_url:
            logger.info("Sending results to API...")
            await send_log("info", "Sending results to API", status="sending_results")
            await send_results_to_api(results, JOB_ID, results_webhook_url)
        else:
            logger.info(f"No results webhook URL provided. Results: {json.dumps(results, indent=2)}")
            await send_log("info", "Processing complete", status="completed")
            
        logger.info("All accounts processed successfully!")
        await send_log("success", "All accounts processed successfully!", status="completed")

    except Exception as e:
        logger.error(f"FATAL ERROR: {str(e)}")
        await send_log("error", f"Fatal error: {str(e)}", status="failed")

if __name__ == "__main__":
    asyncio.run(main())