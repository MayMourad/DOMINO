from app.services.dependency_graph import EDGE_TYPES, analyze_impact, build_graph, topological_task_order
from app.services.households import load_fixture
from tests.conftest import ev


def cats(sim):
    return {n.id: n.category for n in sim.nodes}


def test_graph_edges_are_typed(amina):
    g = build_graph(amina)
    types = {d["type"] for _, _, d in g.edges(data=True)}
    assert types <= EDGE_TYPES
    assert any(d["type"] == "enables" for _, _, d in g.edges("T01", data=True))
    assert any(d["type"] == "depends_on" for _, _, d in g.out_edges("T03", data=True))
    order = topological_task_order(amina)
    assert order.index("T01") < order.index("T03")


def test_flagship_direct_and_indirect_impact(amina, amina_out):
    sim = analyze_impact(amina, amina_out)
    c = cats(sim)
    assert [c[t] for t in ("T01", "T02", "T03")] == ["directly_disrupted"] * 3
    assert c["T04"] == "unaffected" and c["R02"] == "unaffected" and c["P02"] == "unaffected"
    assert c["M01"] == "at_risk_dependency" and c["P04"] == "at_risk_dependency"
    t03 = next(n for n in sim.nodes if n.id == "T03")
    paths = [p.nodeIds for p in t03.causalPaths]
    assert ["e1", "P01", "T03"] in paths and any("M01" in p for p in paths)  # both causal paths preserved
    assert sim.cascade[0].depth == 0 and sim.maxDepth >= 3
    assert sim.postDisruptionCoverage.weightedCoverage < sim.baselineCoverage.weightedCoverage


def test_indirect_only_impact_when_prerequisite_delayed(amina):
    sim = analyze_impact(amina, [ev("d", "task_rescheduled", ["T01"], 960, 1010)])
    c = cats(sim)
    assert c["T01"] == "directly_disrupted" and c["T03"] == "at_risk_dependency" and c["T04"] == "unaffected"
    t03 = next(n for n in sim.nodes if n.id == "T03")
    assert t03.causalPaths and t03.causalPaths[0].nodeIds[-2] == "M01"


def test_no_events_means_nothing_affected(amina):
    sim = analyze_impact(amina, [])
    assert all(n.category == "unaffected" for n in sim.nodes)
    assert sim.affectedTaskIds == []


def test_disruption_outside_task_time_does_not_affect_it(amina):
    sim = analyze_impact(amina, [ev("x", "member_unavailable", ["P01"], 1100, 1110)])
    assert cats(sim)["T01"] == "unaffected"


def test_multigenerational_graph():
    h = load_fixture("multigenerational")
    sim = analyze_impact(h, [ev("o", "member_unavailable", ["P02"], 870, 1140)])
    c = cats(sim)
    assert c["T01"] == "directly_disrupted" and c["T04"] == "directly_disrupted" and c["T03"] == "at_risk_dependency"
    assert c["T05"] == "unaffected"
