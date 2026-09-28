"""Analyse scanned verse counts against the standard versification schemes."""
import json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "python-cli"))
from yvsync.versification import BOOKS, Standard, VersionMap, load_overrides  # current engine (eng/org)

SCHEMES = ["eng", "org", "rso", "rsc", "lxx", "vul"]
MAP_LINE = re.compile(r"^([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))? = ([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$")
BOOK_LINE = re.compile(r"^([0-9A-Z]{3})((?: \d+:\d+)+)$")


def read_vrs(name):
    counts, to_org = {}, {}
    for raw in open(os.path.join(HERE, "vrs", f"{name}.vrs"), encoding="utf-8"):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if "=" in line:
            m = MAP_LINE.match(line)
            if not m:
                continue
            b1, c1, v1, v1e, b2, c2, v2, v2e = m.groups()
            v1, v2 = int(v1), int(v2)
            n = min((int(v1e) if v1e else v1) - v1, (int(v2e) if v2e else v2) - v2)
            for i in range(n + 1):
                src = (b1, int(c1), v1 + i)
                if src[2] == 0:
                    continue
                to_org.setdefault(src, (b2, int(c2), v2 + i))
            continue
        m = BOOK_LINE.match(line)
        if m:
            counts[m.group(1)] = [int(p.split(":")[1]) for p in m.group(2).split()]
    return counts, to_org


VRS = {s: read_vrs(s) for s in SCHEMES}


def count(s, b, c):
    cs = VRS[s][0].get(b, [])
    return cs[c - 1] if 0 < c <= len(cs) else 0


def to_org(s, ref):
    return ref if s == "org" else VRS[s][1].get(ref, ref)


COUNTS = os.path.join(HERE, "data", "counts.json")


def load(vid):
    """Read one version from out/<id>.json (fresh scan) or data/counts.json."""
    raw = os.path.join(HERE, "out", f"{vid}.json")
    actual = defaultdict(dict)
    if os.path.exists(raw):
        d = json.load(open(raw))
        gaps, merged = [], []
        for usfm, r in d["chapters"].items():
            b, c = usfm.split(".")
            vs = (r or {}).get("verses") or []
            mx = max(vs) if vs else 0
            actual[b][int(c)] = mx
            if vs and len(vs) != mx:
                gaps.append(f"{usfm}:{','.join(map(str, sorted(set(range(1, mx + 1)) - set(vs))))}")
            if r and r.get("merged"):
                merged.extend(r["merged"])
        return d, actual, gaps, merged
    d = json.load(open(COUNTS))[str(vid)]
    for b, cs in d["counts"].items():
        for i, n in enumerate(cs, 1):
            actual[b][i] = n
    gaps = [f"{k}:{','.join(map(str, v))}" for k, v in d["gaps"].items()]
    return d, actual, gaps, d["merged"]


def analyse(vid):
    d, actual, gaps, merged = load(vid)
    label = d["vrs"] or "eng"
    books_present = [b for b in BOOKS if b in actual]
    disc = Counter()  # outcome over discriminating chapters
    other_fits = Counter()
    none_chapters = []
    for b in books_present:
        n_ch = max([len(VRS[s][0].get(b, [])) for s in SCHEMES] + [max(actual[b])])
        for c in range(1, n_ch + 1):
            counts = {s: count(s, b, c) for s in SCHEMES}
            if len(set(counts.values())) == 1:
                continue  # every scheme agrees; nothing to learn
            a = actual[b].get(c, 0)
            fits = [s for s in SCHEMES if counts[s] == a]
            if label in fits:
                disc["label"] += 1
            elif fits:
                disc["other"] += 1
                other_fits[tuple(fits)] += 1
            else:
                disc["none"] += 1
                none_chapters.append(f"{b}.{c}({a})")

    # Current engine (eng/org detection + our correction tables, keyed by abbr).
    std = Standard.load()
    abbr_for_overrides = {93: "LSG", 111: "NIV", 1588: "AMP"}.get(vid, "")
    vm = VersionMap.build(d["abbr"], std, {b: dict(actual[b]) for b in books_present},
                          overrides=load_overrides(abbr_for_overrides) if abbr_for_overrides else None)
    skipped = sum(actual[b].get(c, 0) for b in books_present for c in vm.skipped_chapters(b))
    # Where the labelled scheme fits a chapter's count, assume it's the truth
    # and compare the engine's canonical ref with the label's.
    wrong, wrong_chapters = 0, Counter()
    for b in books_present:
        for c, a in actual[b].items():
            if a == 0 or count(label, b, c) != a:
                continue
            for v in range(1, a + 1):
                ref = (b, c, v)
                eng_canon = vm.to_canon.get(ref)
                if eng_canon is None:
                    continue  # skipped: not wrong, just not synced
                if eng_canon != to_org(label, ref):
                    wrong += 1
                    wrong_chapters[f"{b}.{c}"] += 1
    total = sum(a for b in books_present for a in actual[b].values())
    return {
        "id": vid, "abbr": d["abbr"], "title": d["title"], "lang": d["lang"], "label": label,
        "books": len(books_present), "verses": total,
        "disc_label": disc["label"], "disc_other": disc["other"], "disc_none": disc["none"],
        "other_fits": {"/".join(k): v for k, v in other_fits.most_common()},
        "none_chapters": none_chapters,
        "engine_skipped_verses": skipped,
        "engine_wrong_verses": wrong,
        "engine_wrong_chapters": dict(wrong_chapters.most_common()),
        "gaps": gaps, "merged": merged,
    }


if __name__ == "__main__":
    out_dir = os.path.join(HERE, "out")
    ids = ([int(f[:-5]) for f in os.listdir(out_dir) if f.endswith(".json")] if os.path.isdir(out_dir)
           else [int(k) for k in json.load(open(COUNTS))])
    results = [analyse(i) for i in sorted(ids)]
    json.dump(results, open(os.path.join(HERE, "data", "analysis.json"), "w"), ensure_ascii=False, indent=1)
    for r in results:
        print(f"{r['abbr']:>14} {r['lang']:>6} label={r['label']:<4} books={r['books']:>2} "
              f"disc label/other/none={r['disc_label']}/{r['disc_other']}/{r['disc_none']} "
              f"skip={r['engine_skipped_verses']} WRONG={r['engine_wrong_verses']} gaps={len(r['gaps'])} merged={len(r['merged'])}")
