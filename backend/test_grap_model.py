import requests
import json

# Configuration
# Make sure this matches your backend port (default 8001)
BACKEND_URL = "http://localhost:8001/api/pollution/ml-ahmedabad-grap"

# Test Data
payload = {
    "PM2.5": 120.5,
    "PM10": 210.0,
    "NO2": 45.0,
    "SO2": 12.0,
    "CO": 1.5,
    "Temperature": 30.0,
    "Wind Speed": 5.5
}

print(f"Sending POST request to {BACKEND_URL}...")
print(f"Payload: {json.dumps(payload, indent=2)}")

try:
    response = requests.post(BACKEND_URL, json=payload)
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        print("Success! Response:")
        print(json.dumps(response.json(), indent=2))
    else:
        print("Error Response:")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print(f"\n[ERROR] Could not connect to {BACKEND_URL}")
    print("Make sure the backend is running on port 8001.")
except Exception as e:
    print(f"\n[ERROR] An error occurred: {e}")
