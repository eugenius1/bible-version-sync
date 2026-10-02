"""Fetch the text of whole versions, verse by verse, for checking numbering.

Same API and pace as scan.py, read-only. Bible text isn't committed: each
version goes to out/text/<id>.json (gitignored), resumable per version.

    python3 text.py <bible ids...>

Each file maps "BOOK.chapter" to {verse: text}. A Psalm title (bible.com's
`d` paragraph, outside any verse) is verse "0"; a merged span is keyed by its
verses joined with "+" ("16+17"). Footnotes, cross references and headings
are dropped. A chapter the version lacks is null.
"""
import json, os, sys, time
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

from scan import OUT, PROT, get, plain_chapters

TEXT = os.path.join(OUT, "text")
os.makedirs(TEXT, exist_ok=True)

SKIP = {"note", "heading", "label"}  # classes whose text isn't the verse's


class Verses(HTMLParser):
    def __init__(self, usfm):
        super().__init__(convert_charrefs=True)
        self.prefix = usfm + "."
        self.stack = []  # (tag, verse key or None, skipping)
        self.verses = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        key, skip = (self.stack[-1][1], self.stack[-1][2]) if self.stack else (None, False)
        if "verse" in classes and a.get("data-usfm"):
            parts = [p[len(self.prefix):] if p.startswith(self.prefix) else p for p in a["data-usfm"].split("+")]
            key = "+".join(parts)
            self.verses[key] = self.verses.get(key, "") + " "  # a poetry line or paragraph break
        elif tag == "div" and "d" in classes:
            key = "0"
        if classes & SKIP:
            skip = True
        self.stack.append((tag, key, skip))

    def handle_endtag(self, tag):
        while self.stack:
            if self.stack.pop()[0] == tag:
                break

    def handle_data(self, data):
        if not self.stack:
            return
        _, key, skip = self.stack[-1]
        if key is None or skip:
            return
        self.verses[key] = self.verses.get(key, "") + data


def chapter(vid, usfm):
    d = get(f"chapter.json?id={vid}&reference={usfm}")
    if d is None:
        return usfm, None
    p = Verses(usfm)
    p.feed(d.get("content", ""))
    return usfm, {k: " ".join(v.split()) for k, v in p.verses.items() if v.strip()}


def fetch(vid):
    path = os.path.join(TEXT, f"{vid}.json")
    if os.path.exists(path):
        return
    meta = get(f"version.json?id={vid}")
    books = [b for b in meta.get("books", []) if b["usfm"] in PROT]
    chs = [c["usfm"] for b in books for c in b["chapters"] if c.get("canonical")]
    t0 = time.time()
    with ThreadPoolExecutor(6) as pool:
        res = dict(pool.map(lambda u: chapter(vid, u), chs))
    # BOOK.<n>_1 chapters (NR2006's Psalms) become BOOK.<n>, as in scan.py;
    # their verse keys keep the suffixed prefix stripped already, since the
    # parser strips whatever prefix the chapter was requested with.
    res = plain_chapters(vid, {u: (r and {"verses": [1], "merged": [], "text": r}) for u, r in res.items()})
    res = {u: (r and r["text"]) for u, r in res.items()}
    json.dump({"id": vid, "abbr": meta["local_abbreviation"], "lang": meta["language"]["language_tag"],
               "vrs": meta.get("vrs"), "chapters": res}, open(path + ".tmp", "w"), ensure_ascii=False)
    os.replace(path + ".tmp", path)
    print(f"{vid} {meta['local_abbreviation']}: {len(chs)} chapters in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    for vid in map(int, sys.argv[1:]):
        try:
            fetch(vid)
        except Exception as e:
            print(f"{vid} ERROR {e}", flush=True)
    print("DONE", flush=True)
