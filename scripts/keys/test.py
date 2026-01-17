import requests
import os

# Manually paste your URL here to test
url = "https://v0-ipo-automator-git-uat3-basbhais-projects.vercel.app/api/callback"

payload = {
    "runId": "test-123",
    "username": "tester",
    "status": "processing",
    "message": "Hello from manual test"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Connection Error: {e}")