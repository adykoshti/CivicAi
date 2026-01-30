import requests
import time

url = "http://localhost:8001/predict-latest-aqi"

try:
    print("Fetching prediction from backend...")
    resp = requests.get(url)
    if resp.status_code == 200:
        data = resp.json()
        print("\nPrediction Response:")
        print(f"Predicted AQI: {data.get('predicted_aqi')}")
        print(f"Actual AQI: {data.get('actual_aqi')}")
        print(f"Source: {data.get('source')}")
        print(f"Pollutants: {data.get('current_pollutants')}")
        
        pred = data.get('predicted_aqi')
        actual = data.get('actual_aqi')
        
        if pred and actual:
            diff = abs(pred - actual)
            print(f"\nDifference: {diff}")
            if diff < 15:
                print("[PASS] Prediction is close to Actual.")
            else:
                print("[FAIL] Prediction discrepancy too high.")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"Connection failed: {e}")
