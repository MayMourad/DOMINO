import pytest

from app.services.benchmarks import run_suite

pytestmark = pytest.mark.benchmark


def test_full_benchmark_suite_has_no_failures():
    r = run_suite()
    assert r["totalCases"] >= 30
    failed = [(x["id"], x["failures"]) for x in r["results"] if x["status"] == "fail"]
    assert not failed, failed
    assert r["counts"]["pass"] >= 30
