"""Run the annotated-sentence Gemini evaluation N times against a deployed backend and save every run.
Usage: python scripts/ai_eval_runs.py <API_BASE> [N=3]   (the endpoint is rate limited to 2 calls/min, so runs are spaced)
"""

import json
import statistics
import sys
import time
import urllib.request

base = sys.argv[1].rstrip("/")
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
runs = []
for i in range(n):
    if i:
        time.sleep(35)
    req = urllib.request.Request(base + "/v1/benchmarks/ai-interpretation", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
    d = json.load(urllib.request.urlopen(req, timeout=180))
    runs.append(d)
    miss = [(r["id"], r.get("observed")) for r in d["results"] if not r.get("exact")]
    print(f"run {i + 1}: model={d['model']} completed={d['completed']}/{d['total']} entity={d['entityAccuracy']} type={d['typeAccuracy']} "
          f"time={d['timeAccuracy']} uncertainty={d['uncertaintyAccuracy']} exact={d['exactMatchAccuracy']} misses={miss}")
ex = [r["exactMatchAccuracy"] for r in runs if r["exactMatchAccuracy"] is not None]
summary = {"runs": len(runs), "exactMatchPerRun": ex, "meanExactMatch": round(statistics.mean(ex), 4) if ex else None,
           "model": runs[0]["model"], "note": "Gemini is not fully deterministic; accuracy varies run to run."}
print(json.dumps(summary))
json.dump({"summary": summary, "runs": runs}, open("docs/benchmark-results/ai-interpretation.json", "w"), indent=1)
