"""Call /v1/events/interpret on a deployed backend once and print the (sanitized) result. Usage: python scripts/probe_ai.py <API_BASE>"""

import json
import sys
import urllib.error
import urllib.request

base = sys.argv[1].rstrip("/")
h = json.load(urllib.request.urlopen(base + "/v1/fixtures/amina"))
body = json.dumps({"householdSnapshot": h, "text": "Amina cannot help until 6 PM", "nowMin": 870}).encode()
req = urllib.request.Request(base + "/v1/events/interpret", data=body, headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.status, json.dumps(json.load(r), indent=1)[:1500])
except urllib.error.HTTPError as e:
    print(e.code, json.dumps(json.load(e), indent=1)[:1500])
