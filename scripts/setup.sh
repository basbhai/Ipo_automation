#!/bin/bash
set -e

echo "Installing Python dependencies..."
pip install -r scripts/requirements.txt

echo "Installing Playwright browsers..."
playwright install chromium

echo "Setup complete! You can now run the automation script."
