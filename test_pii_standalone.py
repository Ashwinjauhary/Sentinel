import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from detectors.pii import detect_pii

messages = [
    "My email is john.doe@example.com, please update my profile.",
    "Call me at +91 9876543210 regarding my ticket.",
    "My credit card is 1234-5678-9012-3456, please process the payment.",
]

for msg in messages:
    print(f"Testing: {msg}")
    result = detect_pii(msg)
    print(f"Result: {result}\n")
