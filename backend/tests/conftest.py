import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.models.domain import Disruption  # noqa: E402
from app.services.households import load_fixture  # noqa: E402


def ev(id, typ, ids, s, e, value=None):
    return Disruption(id=id, type=typ, affectedEntityIds=ids, startMin=s, endMin=e, value=value, confirmed=True)


@pytest.fixture
def amina():
    return load_fixture("amina")


@pytest.fixture
def amina_out():
    return [ev("e1", "member_unavailable", ["P01"], 870, 1080)]


@pytest.fixture
def khalid_out():
    return [ev("e2", "member_unavailable", ["P02"], 880, 940)]
