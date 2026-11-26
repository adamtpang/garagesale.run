#!/usr/bin/env python3
"""Garage Sale Town relay: polls the app's pending queue and wakes the Grok Bot worker.
Secrets are read from files and never logged."""
import json, time, urllib.request, urllib.error, datetime, sys

BASE = "https://grokbothackathon.vercel.app"
D = "/workspace/gst/"
def rd(p): return open(D + p).read().strip()

def log(msg):
    print(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)

def req(url, method="GET", body=None, headers=None, timeout=10):
    data = json.dumps(body).encode() if body is not None else None
    h = {"content-type": "application/json", "user-agent": "gst-relay/1"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, b""

done = set()       # (job_id, event) already woken this session
retry_at = {}      # (job_id, event) -> next attempt time
polls = 0
log("relay starting")
while True:
    try:
        wk = rd(".worker_key_nonl")
        st, raw = req(f"{BASE}/api/pending", headers={"x-worker-key": wk})
        polls += 1
        if st != 200:
            log(f"pending poll failed: HTTP {st}")
        else:
            items = json.loads(raw or b"[]")
            if polls % 30 == 1:
                log(f"poll ok ({len(items)} pending)")
            for it in items:
                k = (it.get("job_id"), it.get("event"), it.get("key") or "")
                if not k[0] or not k[1]:
                    continue
                if k not in done and time.time() >= retry_at.get(k, 0):
                    try:
                        s2, _ = req(rd(".webhook_url"), "POST",
                                    dict({"job_id": k[0], "kind": it.get("kind"), "event": k[1]}, **({"payload": it["payload"]} if it.get("payload") is not None else {})),
                                    {"Authorization": "Bearer " + rd(".webhook_key")}, timeout=15)
                    except Exception as e:
                        s2 = f"error {type(e).__name__}"
                    if isinstance(s2, int) and 200 <= s2 < 300:
                        done.add(k)
                        log(f"woke worker for job {k[0]} event {k[1]} (HTTP {s2})")
                        req(f"{BASE}/api/jobs/{k[0]}/events", "POST",
                            {"type": "log", "message": "Grok Bot worker woken" + ("" if k[1] == "created" else f" ({k[1]})")}, {"x-worker-key": wk})
                    else:
                        retry_at[k] = time.time() + 10
                        log(f"webhook for job {k[0]} event {k[1]} failed ({s2}); retrying in 10s")
                        continue
                if k in done:
                    s3, _ = req(f"{BASE}/api/jobs/{k[0]}/dispatched", "POST", {"event": k[1], "key": k[2]}, {"x-worker-key": wk})
                    log(f"marked dispatched job {k[0]} event {k[1]} (HTTP {s3})")
    except Exception as e:
        log(f"loop error: {type(e).__name__}")
    time.sleep(2)
