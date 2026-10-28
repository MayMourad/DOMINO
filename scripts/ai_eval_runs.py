"""Run the natural-language interpretation evaluation against a deployed backend and save every run.

Usage: python scripts/ai_eval_runs.py <API_BASE> [--engine gemini|rules] [--dataset annotated|heldout] [--runs N]

Gemini is evaluated in paced batches of 4 sentences (provider rate limits + the host's request timeout); the built-in
rule parser is deterministic and runs in one call.
"""

import argparse
import json
import statistics
import time
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("base")
ap.add_argument("--engine", default="gemini")
ap.add_argument("--dataset", default="annotated")
ap.add_argument("--runs", type=int, default=1)
a = ap.parse_args()
base = a.base.rstrip("/")
prefix = "H" if a.dataset == "heldout" else "A"


def call(ids=None):
    req = urllib.request.Request(base + "/v1/benchmarks/ai-interpretation", data=json.dumps({"engine": a.engine, "dataset": a.dataset, "ids": ids}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=240))


runs = []
for i in range(a.runs):
    results, meta = [], None
    batches = [None] if a.engine == "rules" else [[f"{prefix}{n:02d}" for n in range(s, s + 4)] for s in (1, 5, 9)]
    for j, ids in enumerate(batches):
        if j or i:
            time.sleep(20 if a.engine == "gemini" else 0)
        d = call(ids)
        meta = meta or d
        results += d["results"]
    ok = [r for r in results if r["status"] == "ok"]
    rate = lambda k: round(sum(1 for r in ok if r[k]) / len(ok), 4) if ok else None  # noqa: E731
    run = {"engine": a.engine, "dataset": a.dataset, "model": meta["model"], "total": len(results), "completed": len(ok), "errors": len(results) - len(ok),
           "entityAccuracy": rate("entityOk"), "typeAccuracy": rate("typeOk"), "timeAccuracy": rate("timeOk"), "uncertaintyAccuracy": rate("uncertaintyOk"),
           "exactMatchAccuracy": rate("exact"), "results": results}
    runs.append(run)
    print(f"run {i + 1}: {a.engine}/{a.dataset} completed={run['completed']}/{run['total']} exact={run['exactMatchAccuracy']} "
          f"misses={[(r['id'], r.get('observed') or r.get('error')) for r in results if not r.get('exact')]}")
ex = [r["exactMatchAccuracy"] for r in runs if r["exactMatchAccuracy"] is not None]
summary = {"engine": a.engine, "dataset": a.dataset, "runs": len(runs), "exactMatchPerRun": ex, "meanExactMatch": round(statistics.mean(ex), 4) if ex else None}
print(json.dumps(summary))
json.dump({"summary": summary, "runs": runs}, open(f"docs/benchmark-results/ai-{a.engine}-{a.dataset}.json", "w"), indent=1)
