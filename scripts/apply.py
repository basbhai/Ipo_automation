import asyncio
import json
import os
import sys
import random
import logging

# Setup Logging for GitHub Console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed.")
    sys.exit(1)

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the LOGIN page using the Code (e.g., 13700)."""
    try:
        logger.info(f"Step: Opening DP dropdown to search for {bank_code}...")
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000) 
        
        option_locator = page.locator(f"li.select2-results__option:has-text('({bank_code})')")
        
        if await option_locator.is_visible():
            await option_locator.click()
            logger.info(f"SUCCESS: DP {bank_code} selected.")
            return True
        else:
            logger.error(f"FAIL: Could not find DP result for code {bank_code}.")
            return False
    except Exception as e:
        logger.error(f"EXCEPTION selecting DP: {str(e)}")
        return False

async def process_account(browser, account):
    """Integrated core logic from Colab version for GitHub Actions."""
    context = None
    try:
        # Financial sites often have SSL issues on headless runners; ignore_https_errors fixes this.
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login
        logger.info(f"--- Starting Account: {account.get('username')} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        
        if not await select_login_dp(page, account['dp']):
            return False

        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful!")

        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 3. Find Ordinary Share & Click Apply
        ipo_row = page.locator(".company-list", has=page.locator("span.isin", has_text="Ordinary Shares")).first
        apply_btn = ipo_row.locator("button.btn-issue:has-text('Apply')")
        
        if await apply_btn.count() > 0:
            await apply_btn.click()
            logger.info("SUCCESS: Apply form opened.")
        else:
            logger.warning("FAIL: No active 'Ordinary Shares' found.")
            return False

        # 4. Wizard Step 1: Form Filling
        # Dynamic Bank & Account Selection (picks first available there)
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)
        
        await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
        await page.select_option("#accountNumber", index=1)
        
        await page.wait_for_timeout(1000)
        branch = await page.input_value("#selectBranch")
        logger.info(f"Step: Bank selected. Branch detected: {branch}")

        # Applied Kitta & Amount Trigger
        await page.fill("#appliedKitta", str(account['units']))
        await page.focus("#appliedKitta")
        await page.keyboard.press("Tab") 
        await page.locator("#appliedKitta").dispatch_event("blur")
        
        # Wait for auto-calculation
        await page.wait_for_timeout(1000)
        amount = await page.input_value("#amount")
        logger.info(f"Step: Units {account['units']} entered. Total Amount: NPR {amount}")

        # CRN & Disclaimer
        await page.fill("#crnNumber", str(account['crn']))
        await page.check("#disclaimer", force=True)
        
        # Proceed to PIN
        await page.click("button[type='submit']:has-text('Proceed')")
        logger.info("Step: Proceeding to PIN screen...")

        # 5. Wizard Step 2: PIN & Final Submit
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account['pin']))
        
        # FINAL APPLY CLICK
        await page.click("button[type='submit']:has-text('Apply')")
        await page.wait_for_timeout(2000)
        logger.info(f"🚀 SUCCESS: IPO submitted for {account['username']}!")
        
        return True

    except Exception as e:
        logger.error(f"CRITICAL ERROR for {account.get('username')}: {str(e)}")
        return False
    finally:
        if context:
            await context.close()

async def main():
    try:
        # GitHub Secrets: ACCOUNTS_JSON should be a stringified list of objects
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        token = os.getenv('BROWSERLESS_TOKEN')

        if not token:
            logger.error("BROWSERLESS_TOKEN is missing. Please set it in GitHub Secrets.")
            return

        async with async_playwright() as p:
            logger.info("Connecting to Browserless.io...")
            endpoint = f"wss://production-sfo.browserless.io?token={token}"
            browser = await p.chromium.connect_over_cdp(endpoint)
            
            try:
                for account in accounts:
                    await process_account(browser, account)
                    # Gentle delay between accounts to prevent IP flagging
                    await asyncio.sleep(random.uniform(5, 10))
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"FATAL ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())