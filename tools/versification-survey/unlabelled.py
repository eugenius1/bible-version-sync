"""Plan which unlabelled versions to scan, cheapest languages first.

A language counts as covered when every one of its versions has YouVersion's
numbering label or has been scanned (data/counts.json). For each unlabelled,
unscanned version this reads version.json (cached in out/, as names.py does)
for the chapters it has, then orders the uncovered languages by how many
chapters scanning them would take and prints the ids to scan to reach the
target share of languages.

    python3 unlabelled.py [target, default 0.8]
"""
import json, os, sys, time

from scan import OUT, PROT, get

HERE = os.path.dirname(__file__)
PAUSE = 0.25


def meta(vid):
    file = os.path.join(OUT, f"version-{vid}.json")
    if not os.path.exists(file):
        data = get(f"version.json?id={vid}")
        if data is None: raise RuntimeError(f"not found: {vid}")
        json.dump(data, open(file, "w"), ensure_ascii=False)
        time.sleep(PAUSE)
    return json.load(open(file))


def chapters(vid):
    """Canonical chapters the version has in the 66 books, as scan.py reads them."""
    return sum(1 for b in meta(vid).get("books", []) if b["usfm"] in PROT for c in b["chapters"] if c.get("canonical"))


def main():
    target = float(sys.argv[1]) if len(sys.argv) > 1 else 0.8
    candidates = json.load(open(os.path.join(HERE, "data", "candidates.json")))
    counts = json.load(open(os.path.join(HERE, "data", "counts.json")))
    todo = {tag: [v["id"] for v in vs if not v["vrs"] and str(v["id"]) not in counts] for tag, vs in candidates.items()}
    covered = sum(1 for ids in todo.values() if not ids)
    need = int(target * len(candidates) + 0.999999) - covered
    print(f"{covered} of {len(candidates)} languages covered; {max(need, 0)} more for {target:.0%}")
    cost = {}
    for tag, ids in todo.items():
        if ids: cost[tag] = sum(chapters(i) for i in ids)
    order = sorted(cost, key=lambda t: (cost[t], t))
    pick = order[:max(need, 0)]
    ids = [i for t in pick for i in todo[t]]
    print(f"scan {len(ids)} versions, {sum(cost[t] for t in pick)} chapters:")
    print(" ".join(map(str, ids)))
    print(f"all uncovered languages: {len(order)}, {sum(cost.values())} chapters")


if __name__ == "__main__":
    main()
