"""Record the abbreviation bible.com shows for every surveyed version.

YouVersion gives each version two abbreviations: `abbreviation`, an internal
one (NIV11), and `local_abbreviation`, the one bible.com shows (NIV). The
app names versions after what people see there, so this adds
`local_abbreviation` to data/candidates.json and `local_abbr` to
data/counts.json. Titles are refreshed from bible.com too, and each change is
printed so it shows up for review in the data diff. One request per language (versions.json), cached in out/,
plus version.json for any version the language lists miss.

    python3 names.py
"""
import json, os

from scan import OUT, get

HERE = os.path.dirname(__file__)
CANDIDATES = os.path.join(HERE, "data", "candidates.json")
COUNTS = os.path.join(HERE, "data", "counts.json")


def cached(name, path):
    file = os.path.join(OUT, name)
    if not os.path.exists(file):
        data = get(path)
        if data is None: raise RuntimeError(f"not found: {path}")
        json.dump(data, open(file, "w"), ensure_ascii=False)
    return json.load(open(file))


def main():
    candidates = json.load(open(CANDIDATES))
    counts = json.load(open(COUNTS))
    tags = sorted(set(candidates) | {v["lang"] for v in counts.values()})
    seen = {}
    for tag in tags:
        for v in cached(f"versions-{tag}.json", f"versions.json?language_tag={tag}&type=all")["versions"]:
            seen[v["id"]] = v

    def meta(vid):
        if vid not in seen: seen[vid] = cached(f"version-{vid}.json", f"version.json?id={vid}")
        return seen[vid]

    changed = 0
    for versions in candidates.values():
        for v in versions:
            m = meta(v["id"])
            if m["local_title"] != v["local_title"]: print(f"{v['id']}: title now {m['local_title']!r}, was {v['local_title']!r}")
            if m["local_abbreviation"] != m["abbreviation"]: changed += 1
            v["local_abbreviation"] = m["local_abbreviation"]
            v["local_title"] = m["local_title"]
    for vid, v in counts.items():
        m = meta(int(vid))
        if m["local_title"] != v["title"]: print(f"{vid}: title now {m['local_title']!r}, was {v['title']!r}")
        # Right after abbr, so the file reads as before.
        items = list(v.items())
        items = [(k, x) for k, x in items if k != "local_abbr"]
        i = [k for k, _ in items].index("abbr") + 1
        counts[vid] = dict(items[:i] + [("local_abbr", m["local_abbreviation"])] + items[i:])
        counts[vid]["title"] = m["local_title"]

    open(CANDIDATES, "w").write(json.dumps(candidates, indent=0, ensure_ascii=False))
    open(COUNTS, "w").write(json.dumps(counts, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(seen)} versions seen; {changed} candidates show an abbreviation other than their internal one")


if __name__ == "__main__":
    main()
