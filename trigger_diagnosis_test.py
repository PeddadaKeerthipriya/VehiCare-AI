import sys
import json
import urllib.request

def trigger_diagnosis_webhook(webhook_url):
    payload = {
        "vehicle_id": "ce149694-3228-4951-897a-5be5ed52f55c",
        "user_id": "c40d75b2-4419-44d4-bc5c-2aadc4411f62",
        "symptom": "Engine makes a loud squeaking noise when accelerating and braking feels soft",
        "vehicle_info": {
            "make": "Toyota",
            "model": "Innova",
            "year": 2023,
            "odometer_km": 15000
        },
        "service_history": [],
        "retrieved_knowledge_text": "Symptom: Engine squeal during acceleration\nPossible Cause: Loose or worn serpentine accessory belt\nRemedy: Inspect belt tensioner and replace belt if glazed or cracked."
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"Sending test diagnosis payload to n8n webhook: {webhook_url}")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"HTTP Status Code: {response.status}")
            print(f"Response Output: {response.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error triggering webhook: {e}")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://credencer.app.n8n.cloud/webhook-test/diagnosis-result"
    trigger_diagnosis_webhook(url)
