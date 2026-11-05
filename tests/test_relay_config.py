"""Relay startup config: required env names, no secret logging, no file reads."""
import importlib.util
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELAY = ROOT / "relay" / "relay.py"

CANARY_BASE = "https://canary-base.example.test"
CANARY_WORKER = "canary-worker-key-value"
CANARY_WEBHOOK = "https://canary-hooks.example.test/routine/canary-path"
CANARY_SENDER = "canary-webhook-sender-key"


def load_relay():
    spec = importlib.util.spec_from_file_location("gst_relay_under_test", RELAY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def child_env(**overrides):
    env = os.environ.copy()
    for name in load_relay().REQUIRED_ENV:
        env.pop(name, None)
    for name, value in overrides.items():
        if value is None:
            env.pop(name, None)
        else:
            env[name] = value
    return env


def run_relay(env):
    return subprocess.run(
        [sys.executable, str(RELAY)],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )


class RelayConfigTest(unittest.TestCase):
    def test_load_config_strips_base_slash_and_whitespace(self):
        relay = load_relay()
        cfg = relay.load_config({
            "GARAGESALE_BASE_URL": "  https://grokbothackathon.vercel.app///  ",
            "GST_WORKER_KEY": "  worker-key  ",
            "GST_WEBHOOK_URL": "  https://hooks.example.test/wake  ",
            "GST_WEBHOOK_KEY": "  sender-key  ",
        })
        self.assertEqual(cfg["base"], "https://grokbothackathon.vercel.app")
        self.assertEqual(cfg["worker_key"], "worker-key")
        self.assertEqual(cfg["webhook_url"], "https://hooks.example.test/wake")
        self.assertEqual(cfg["webhook_key"], "sender-key")

    def test_load_config_names_every_missing_variable(self):
        relay = load_relay()
        with self.assertRaises(relay.ConfigError) as caught:
            relay.load_config({
                "GARAGESALE_BASE_URL": "///",
                "GST_WORKER_KEY": "   ",
                "GST_WEBHOOK_URL": "",
            })
        self.assertEqual(caught.exception.missing, relay.REQUIRED_ENV)

    def test_startup_exits_and_logs_only_missing_names(self):
        proc = run_relay(child_env(
            GST_WORKER_KEY=CANARY_WORKER,
            GST_WEBHOOK_URL=CANARY_WEBHOOK,
            GST_WEBHOOK_KEY=CANARY_SENDER,
        ))
        self.assertEqual(proc.returncode, 1)
        output = proc.stdout + proc.stderr
        self.assertIn("GARAGESALE_BASE_URL", output)
        self.assertNotIn("GST_WORKER_KEY", output)
        self.assertNotIn("GST_WEBHOOK_URL", output)
        self.assertNotIn("GST_WEBHOOK_KEY", output)
        for secret in (CANARY_BASE, CANARY_WORKER, CANARY_WEBHOOK, CANARY_SENDER, "Bearer"):
            self.assertNotIn(secret, output)
        self.assertNotIn("relay starting", output)

    def test_startup_lists_all_missing_names_without_values(self):
        proc = run_relay(child_env())
        self.assertEqual(proc.returncode, 1)
        output = proc.stdout + proc.stderr
        for name in load_relay().REQUIRED_ENV:
            self.assertIn(name, output)
        self.assertNotIn("relay starting", output)

    def test_source_does_not_read_workspace_secret_files(self):
        text = RELAY.read_text()
        self.assertNotIn("/workspace/gst", text)
        self.assertNotIn(".worker_key_nonl", text)
        self.assertNotIn(".webhook_url", text)
        self.assertNotIn(".webhook_key", text)
        self.assertIn('headers={"x-worker-key": wk}', text)
        self.assertIn('{"Authorization": "Bearer " + webhook_key}', text)


if __name__ == "__main__":
    unittest.main()
