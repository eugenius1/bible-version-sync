"""Collect per-chapter verse numbers for a set of YouVersion versions.

Uses bible.youversionapi.com (the API behind bible.com) read-only, gently,
for a one-off survey. Resumable: one JSON file per version in out/.
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
    json.dump({"id": vid, "abbr": meta["abbreviation"], "title": meta["local_title"], "lang": meta["language"]["language_tag"],
               "vrs": meta.get("vrs"), "books": [b["usfm"] for b in books], "chapters": res},
              open(path + ".tmp", "w"), ensure_ascii=False)
    os.replace(path + ".tmp", path)
    print(f"{vid} {meta['abbreviation']}: {len(chs)} chapters in {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    for vid in map(int, sys.argv[1:]):
        try: scan(vid)
        except Exception as e: print(f"{vid} ERROR {e}", flush=True)
    print("DONE", flush=True)
