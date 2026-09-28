"""Collect per-chapter verse numbers for a set of YouVersion versions.

Uses bible.youversionapi.com (the API behind bible.com) read-only, gently,
for a one-off survey. Resumable: one JSON file per version in out/.

    python3 scan.py <bible ids...>         scan into out/
    python3 scan.py --add <bible ids...>   copy those scans into data/counts.json
"""
import json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

H = {"Accept": "application/json", "Referer": "https://web.youversionapi.com", "User-Agent": "Web App: Production",
     "X-YouVersion-Client": "youversion", "X-YouVersion-App-Platform": "web", "X-YouVersion-App-Version": "3"}
BASE = "https://bible.youversionapi.com/3.1/"
OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
PROT = set("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split())

def get(path, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=H), timeout=40) as r:
                return json.loads(r.read())["response"]["data"]
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if e.code in (429, 500, 502, 503, 504): time.sleep(2 ** i * 2); continue
            raise
        except Exception:
            time.sleep(2 ** i * 2)
    raise RuntimeError(f"failed: {path}")

USFM = re.compile(r'data-usfm="([^"]+)"')

def chapter(vid, usfm):
    d = get(f"chapter.json?id={vid}&reference={usfm}")
    if d is None: return usfm, None
    nums, merged = set(), []
    prefix = usfm + "."
    for attr in USFM.findall(d.get("content", "")):
        parts = attr.split("+")
        vs = [int(p[len(prefix):]) for p in parts if p.startswith(prefix) and p[len(prefix):].isdigit()]
        nums.update(vs)
        if len(vs) > 1: merged.append(attr)
    return usfm, {"verses": sorted(nums), "merged": sorted(set(merged))}

def scan(vid):
    path = os.path.join(OUT, f"{vid}.json")
    if os.path.exists(path): return
    meta = get(f"version.json?id={vid}")
    books = [b for b in meta.get("books", []) if b["usfm"] in PROT]
    chs = [c["usfm"] for b in books for c in b["chapters"] if c.get("canonical")]
    t0 = time.time()
    with ThreadPoolExecutor(6) as pool:
        res = dict(pool.map(lambda u: chapter(vid, u), chs))
    json.dump({"id": vid, "abbr": meta["abbreviation"], "local_abbr": meta["local_abbreviation"], "title": meta["local_title"], "lang": meta["language"]["language_tag"],
               "vrs": meta.get("vrs"), "books": [b["usfm"] for b in books], "chapters": res},
              open(path + ".tmp", "w"), ensure_ascii=False)
    os.replace(path + ".tmp", path)
    print(f"{vid} {meta['abbreviation']}: {len(chs)} chapters in {time.time()-t0:.0f}s", flush=True)

COUNTS = os.path.join(os.path.dirname(__file__), "data", "counts.json")

def chapters_per_book():
    """Chapters per book in English or Hebrew numbering, whichever has more."""
    out = {}
    for name in ("eng", "org"):
        path = os.path.join(os.path.dirname(__file__), "..", "..", "packages", "core", "data", f"{name}.vrs")
        for raw in open(path, encoding="utf-8"):
            parts = raw.split("#", 1)[0].split()
            if len(parts) > 1 and "=" not in parts and parts[0] in PROT:
                out[parts[0]] = max(out.get(parts[0], 0), len(parts) - 1)
    return out

def add(vids):
    """Copy scans from out/ into data/counts.json, in its compact form."""
    counts = json.load(open(COUNTS))
    full = chapters_per_book()
    for vid in vids:
        d = json.load(open(os.path.join(OUT, f"{vid}.json")))
        entry = {"abbr": d["abbr"], "local_abbr": d["local_abbr"], "title": d["title"], "lang": d["lang"], "vrs": d["vrs"],
                 "counts": {}, "gaps": {}, "merged": []}
        odd = [u for u in d["chapters"] if not u.split(".")[1].isdigit()]
        # TUKARA84 (3404) numbers Matthew's chapters 1_1, 2_1...: not USFM, so
        # nothing the engine could map or the highlights API would take.
        if odd: raise ValueError(f"{vid}: chapters that aren't numbers, e.g. {odd[0]}")
        for b in d["books"]:
            chs = sorted((int(u.split(".")[1]), r) for u, r in d["chapters"].items() if u.split(".")[0] == b)
            # By position, to the book's full length: a version may have only
            # some chapters (Luke 15), and a chapter it lacks is 0, as a 404 is.
            by_ch = {c: max(r["verses"], default=0) if r else 0 for c, r in chs}
            entry["counts"][b] = [by_ch.get(c, 0) for c in range(1, max(max(by_ch, default=0), full[b]) + 1)]
            for c, r in chs:
                if not r: continue
                missing = sorted(set(range(1, max(r["verses"], default=0) + 1)) - set(r["verses"]))
                if missing: entry["gaps"][f"{b}.{c}"] = missing
                entry["merged"].extend(r["merged"])
        counts[str(vid)] = entry
    counts = dict(sorted(counts.items()))  # by key as text, as the file always was
    open(COUNTS, "w").write(json.dumps(counts, separators=(",", ":"), ensure_ascii=False))

if __name__ == "__main__":
    if sys.argv[1:2] == ["--add"]:
        add(map(int, sys.argv[2:]))
        sys.exit()
    for vid in map(int, sys.argv[1:]):
        try: scan(vid)
        except Exception as e: print(f"{vid} ERROR {e}", flush=True)
    print("DONE", flush=True)
