import asyncio
import json
import os
import sys
import random
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed. Install with: pip install playwright")
    sys.exit(1)


async def fill_dp_field_with_select2(page, bank_dp_value):
    """
    Handle Select2 search-and-select interaction for DP (Bank) field.
    
    This function:
    1. Clicks the Select2 container to open the dropdown
    2. Types the bank DP value in the search field
    3. Waits for and selects the matching option
    """
    try:
        logger.info(f"Attempting to fill DP field with value: {bank_dp_value}")
        
        # Find and click the Select2 container
        select2_container = page.locator("span.select2.select2-container--default")
        
        if not await select2_container.is_visible():
            logger.warning("Select2 container not visible, attempting to locate by aria-label")
            select2_container = page.locator('[aria-label="Search for option"]').first
        
        # Click to open the dropdown
        await select2_container.click()
        await page.wait_for_timeout(500)
        
        # Find the search input within Select2
        search_input = page.locator(".select2-search__field, input.select2-search__field")
        
        if not await search_input.is_visible():
            logger.info("Search input not immediately visible, waiting...")
            await page.wait_for_selector("input.select2-search__field", timeout=5000)
            search_input = page.locator("input.select2-search__field")
        
        # Type the bank DP value
        await search_input.fill(bank_dp_value)
        await page.wait_for_timeout(300)  # Allow time for filtering
        
        # Wait for the option to appear and select it
        option_selector = f".select2-results__option:has-text('{bank_dp_value}')"
        await page.wait_for_selector(".select2-results__option", timeout=5000)
        
        # Select the matching option
        matching_option = page.locator(".select2-results__option").filter(has_text=bank_dp_value).first
        
        if await matching_option.is_visible():
            await matching_option.click()
            logger.info(f"Successfully selected DP: {bank_dp_value}")
            await page.wait_for_timeout(300)
            return True
        else:
            logger.error(f"Could not find matching option for DP: {bank_dp_value}")
            return False
            
    except Exception as e:
        logger.error(f"Error filling DP field with Select2: {str(e)}")
        return False


async def process_account(browser, account):
    """
    Process a single account's IPO application.
    
    Args:
        browser: Playwright browser instance
        account: Dictionary with keys: dp, username, password, pin, crn, units
    """
    context = None
    page = None
    
    try:
        # Create new context for this account (prevents session/cookie leakage)
        context = await browser.new_context()
        page = await context.new_page()
        
        logger.info(f"Processing account: {account.get('username', 'unknown')}")
        
        # Step 1: Navigate to login page
        logger.info("Navigating to Mero Share...")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle")
        
        # Step 2: Login
        logger.info("Attempting login...")
        await page.fill("input[name='username']", account['username'])
        await page.fill("input[name='password']", account['password'])
        await page.click("button:has-text('Login')")
        
        # Wait for navigation
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        
        # Step 3: Navigate to ASBA (Apply for IPO)
        logger.info("Navigating to ASBA section...")
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Step 4: Find and click "Apply" button for Ordinary Shares
        logger.info("Looking for 'Ordinary Shares' apply button...")
        apply_button = page.locator("//tr[contains(., 'Ordinary Shares')]//button[text()='Apply']")
        
        retry_count = 0
        while retry_count < 2:
            try:
                await apply_button.click(timeout=3000)
                logger.info("Clicked Apply button")
                await page.wait_for_timeout(2000)
                break
            except Exception as e:
                retry_count += 1
                if retry_count < 2:
                    logger.warning(f"Apply button click failed (attempt {retry_count}), retrying in 3s...")
                    await page.wait_for_timeout(3000)
                else:
                    logger.error(f"Failed to click Apply button after {retry_count} attempts")
                    return False
        
        # Step 5: Fill the application form
        logger.info("Filling application form...")
        
        # Fill Units (Kitta)
        units_input = page.locator("input[name='units'], input[placeholder*='Units'], input[placeholder*='Kitta']").first
        if await units_input.is_visible():
            await units_input.fill(str(account['units']))
            logger.info(f"Filled units: {account['units']}")
        
        # Fill DP (Bank) field using Select2 handler
        success = await fill_dp_field_with_select2(page, str(account['dp']))
        if not success:
            logger.error("Failed to fill DP field with Select2")
            return False
        
        # Fill CRN (Citizen Registration Number)
        crn_input = page.locator("input[name='crn'], input[placeholder*='CRN'], input[placeholder*='Citizen']").first
        if await crn_input.is_visible():
            await crn_input.fill(str(account['crn']))
            logger.info(f"Filled CRN: {account['crn']}")
        
        # Check Disclaimer checkbox
        disclaimer_checkbox = page.locator("input[type='checkbox'][name*='disclaimer'], input[type='checkbox'][name*='agree']").first
        if await disclaimer_checkbox.is_visible():
            await disclaimer_checkbox.check()
            logger.info("Checked disclaimer checkbox")
        
        await page.wait_for_timeout(1000)
        
        # Step 6: Enter PIN and Submit
        logger.info("Entering PIN and submitting...")
        pin_input = page.locator("input[name='pin'], input[type='password'][placeholder*='PIN']").first
        if await pin_input.is_visible():
            await pin_input.fill(str(account['pin']))
            logger.info("PIN entered")
        
        # Click Submit button with retry
        submit_button = page.locator("button:has-text('Submit'), button:has-text('SUBMIT')").first
        
        retry_count = 0
        while retry_count < 2:
            try:
                await submit_button.click(timeout=3000)
                logger.info("Clicked Submit button")
                await page.wait_for_load_state("networkidle")
                break
            except Exception as e:
                retry_count += 1
                if retry_count < 2:
                    logger.warning(f"Submit button click failed (attempt {retry_count}), retrying in 3s...")
                    await page.wait_for_timeout(3000)
                else:
                    logger.error(f"Failed to click Submit button after {retry_count} attempts")
                    return False
        
        logger.info(f"Successfully completed application for {account['username']}")
        return True
        
    except Exception as e:
        logger.error(f"Error processing account {account.get('username', 'unknown')}: {str(e)}")
        return False
        
    finally:
        if context:
            await context.close()


async def main():
    """
    Main function to process all accounts from ACCOUNTS_JSON environment variable.
    """
    try:
        # Get accounts from environment variable
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        
        if not accounts:
            logger.error("No accounts provided in ACCOUNTS_JSON")
            return
        
        logger.info(f"Starting IPO application process for {len(accounts)} account(s)")
        
        # Initialize Playwright
        async with async_playwright() as p:
            # Get Browserless token if available, otherwise use local browser
            browserless_token = os.getenv('BROWSERLESS_TOKEN')
            
            if browserless_token:
                logger.info("Connecting to Browserless.io...")
                browser = await p.chromium.connect_over_cdp(
                    f"wss://cdp.browserless.io?token={browserless_token}"
                )
            else:
                logger.info("Starting local browser...")
                browser = await p.chromium.launch(headless=True)
            
            try:
                # Process each account sequentially
                results = {
                    "successful": [],
                    "failed": [],
                    "total_processed": 0
                }
                
                for i, account in enumerate(accounts):
                    logger.info(f"\n--- Processing account {i+1}/{len(accounts)} ---")
                    
                    success = await process_account(browser, account)
                    results["total_processed"] += 1
                    
                    if success:
                        results["successful"].append(account['username'])
                    else:
                        results["failed"].append(account['username'])
                    
                    # Add random delay between accounts to avoid detection
                    if i < len(accounts) - 1:
                        delay = random.uniform(3, 7)
                        logger.info(f"Waiting {delay:.1f}s before next account...")
                        await asyncio.sleep(delay)
                
                # Log final results
                logger.info("\n=== FINAL RESULTS ===")
                logger.info(f"Total processed: {results['total_processed']}")
                logger.info(f"Successful: {len(results['successful'])} - {results['successful']}")
                logger.info(f"Failed: {len(results['failed'])} - {results['failed']}")
                
            finally:
                await browser.close()
    
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
