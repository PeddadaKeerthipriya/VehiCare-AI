"""
Helper script to send sample image and slip_id to n8n Webhook
"""

import sys
import os
import requests

def send_n8n_webhook(webhook_url="http://localhost:5678/webhook-test/service-slip-uploaded"):
    sample_path = "samples/sample_invoice_1.png"

    if not os.path.exists(sample_path):
        from samples.generate_sample_slips import create_sample_invoice_1
        os.makedirs("samples", exist_ok=True)
        create_sample_invoice_1(sample_path)

    print(f"Sending {sample_path} to n8n webhook: {webhook_url}")

    with open(sample_path, "rb") as f:
        files = {"data": ("sample_invoice_1.png", f, "image/png")}
        data = {"slip_id": "11111111-2222-3333-4444-555555555555"}
        
        try:
            resp = requests.post(webhook_url, files=files, data=data, timeout=30)
            print("HTTP Status Code:", resp.status_code)
            print("Response Output:", resp.text)
        except Exception as e:
            print("Error connecting to n8n webhook:", e)

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5678/webhook-test/service-slip-uploaded"
    send_n8n_webhook(url)
