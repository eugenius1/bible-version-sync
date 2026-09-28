"""Verse-number mapping between Bible versions.

Different versions number some verses differently. Two standard systems cover
almost everything we care about:

  eng  - traditional English numbering (NIV, AMP, KJV, ...)
  org  - Hebrew/Greek "original" numbering (BHS / Nestle-Aland). Psalm titles
         are verse 1, Joel has 4 chapters, Malachi has 3, etc.

Many translations (notably French ones like LSG) mix the two chapter by chapter,
so we detect the system per chapter by comparing each chapter's real verse count
with the eng and org counts.

Every verse is converted to a *canonical* reference in the org system. Two
versions agree on a verse when their verses map to the same canonical ref.

Data files (data/eng.vrs, data/org.vrs) are Paratext versification files from
SIL's libpalaso (MIT licence).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

DATA = Path(__file__).parent / "data"

BOOKS = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO "
    "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL "
    "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB "
    "JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split()

# eng.vrs has no mapping for these NT differences; org merges two English verses.
SUPPLEMENTAL_ENG_TO_ORG = {
    ("ACT", 19, 41): ("ACT", 19, 40),
    ("2CO", 13, 13): ("2CO", 13, 12),
    ("2CO", 13, 14): ("2CO", 13, 13),
}

Ref = tuple[str, int, int]  # (book, chapter, verse)

_BOOK_LINE = re.compile(r"^([0-9A-Z]{3})((?: \d+:\d+)+)$")
_MAP_LINE = re.compile(
    r"^([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))? = ([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$"
)


def ref_str(ref: Ref) -> str:
    return f"{ref[0]}.{ref[1]}.{ref[2]}"


def parse_ref(usfm: str) -> Ref:
    book, ch, v = usfm.split(".")
    return (book, int(ch), int(v))


def _read_vrs(path: Path):
    counts: dict[str, list[int]] = {}
    mappings: list[tuple[Ref, Ref]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if "=" in line:
            m = _MAP_LINE.match(line)
            if not m:
                continue  # verse-part splits like "ESG 1:1a" are not supported
            b1, c1, v1, v1e, b2, c2, v2, v2e = m.groups()
            v1, v2 = int(v1), int(v2)
            n1 = (int(v1e) if v1e else v1) - v1
            n2 = (int(v2e) if v2e else v2) - v2
            n = min(n1, n2)
            for i in range(n + 1):
                mappings.append(((b1, int(c1), v1 + i), (b2, int(c2), v2 + i)))
            # Uneven ranges (e.g. PSA 13:0-5 = 13:1-6 when eng has 13:6 too) leave
            # the tail unmapped, which falls back to identity.
            continue
        m = _BOOK_LINE.match(line)
        if m:
            counts[m.group(1)] = [int(p.split(":")[1]) for p in m.group(2).split()]
    return counts, mappings


@dataclass
class Standard:
    eng_counts: dict[str, list[int]]
    org_counts: dict[str, list[int]]
    eng_to_org: dict[Ref, Ref]

    @classmethod
    def load(cls) -> "Standard":
        eng_counts, eng_maps = _read_vrs(DATA / "eng.vrs")
        org_counts, _ = _read_vrs(DATA / "org.vrs")
        eng_to_org: dict[Ref, Ref] = {}
        for src, dst in eng_maps:
            if src[2] == 0:
                continue  # English Psalm titles are unnumbered, so not highlightable
            eng_to_org.setdefault(src, dst)
        eng_to_org.update(SUPPLEMENTAL_ENG_TO_ORG)
        return cls(eng_counts, org_counts, eng_to_org)

    def count(self, scheme: str, book: str, ch: int) -> int:
        counts = (self.eng_counts if scheme == "eng" else self.org_counts).get(book, [])
        return counts[ch - 1] if 0 < ch <= len(counts) else 0

    def to_canon(self, scheme: str, ref: Ref) -> Ref:
        return self.eng_to_org.get(ref, ref) if scheme == "eng" else ref


@dataclass
class VersionMap:
    """Maps one version's verse numbers to canonical (org) refs and back."""

    abbr: str
    # book -> chapter -> "eng" | "org" | None (None = can't map, skip it)
    schemes: dict[str, dict[int, str | None]] = field(default_factory=dict)
    counts: dict[str, dict[int, int]] = field(default_factory=dict)
    to_canon: dict[Ref, Ref] = field(default_factory=dict)
    from_canon: dict[Ref, list[Ref]] = field(default_factory=dict)
    overrides: dict[Ref, Ref] = field(default_factory=dict)

    def chapters(self, book: str) -> list[int]:
        """Chapters of `book` that exist in this version and can be mapped."""
        return sorted(
            c for c, s in self.schemes.get(book, {}).items()
            if s is not None and self.counts[book].get(c, 0) > 0
        )

    def skipped_chapters(self, book: str) -> list[int]:
        return sorted(
            c for c, s in self.schemes.get(book, {}).items()
            if s is None and self.counts[book].get(c, 0) > 0
        )

    @classmethod
    def build(
        cls,
        abbr: str,
        std: Standard,
        known_counts: dict[str, dict[int, int]] | None = None,
        default_scheme: str = "eng",
        overrides: dict[Ref, Ref] | None = None,
    ) -> "VersionMap":
        """known_counts: real verse counts per chapter (may be partial or empty).

        Chapters without known counts inherit their book's majority scheme,
        or `default_scheme` when nothing in the book is known.

        overrides: explicit local ref -> canonical ref for chapters where the
        version follows neither system (see data/overrides/). Every chapter
        touched by an override uses only the override table (unlisted verses in
        it map to the same canonical number).
        """
        known_counts = known_counts or {}
        overrides = overrides or {}
        custom: dict[str, dict[int, int]] = {}
        for b, c, v in overrides:
            custom.setdefault(b, {})
            custom[b][c] = max(custom[b].get(c, 0), v)
        vm = cls(abbr)
        for book in BOOKS:
            actual = known_counts.get(book, {})
            n_ch = max(
                len(std.eng_counts.get(book, [])),
                len(std.org_counts.get(book, [])),
                max(actual, default=0),
            )
            label: dict[int, str] = {}
            for c in range(1, n_ch + 1):
                a = actual.get(c)
                e, o = std.count("eng", book, c), std.count("org", book, c)
                if a is None:
                    label[c] = "unknown"
                elif a == e and a == o:
                    label[c] = "both"
                elif a == e:
                    label[c] = "eng"
                elif a == o:
                    label[c] = "org"
                else:
                    label[c] = "none"
            n_eng = sum(v == "eng" for v in label.values())
            n_org = sum(v == "org" for v in label.values())
            if n_eng or n_org:
                majority = "eng" if n_eng >= n_org else "org"
            else:
                majority = default_scheme
            schemes: dict[int, str | None] = {}
            counts: dict[int, int] = {}
            for c, lab in label.items():
                s = majority if lab in ("both", "unknown") else (None if lab == "none" else lab)
                schemes[c] = s
                if c in actual:
                    counts[c] = actual[c]
                else:
                    counts[c] = std.count(s or majority, book, c)
            for c, max_v in custom.get(book, {}).items():
                schemes[c] = "custom"
                counts[c] = actual.get(c, max_v)
            vm.schemes[book] = schemes
            vm.counts[book] = counts
        vm.overrides = overrides
        vm._index(std)
        return vm

    def _index(self, std: Standard) -> None:
        # Build the maps; if chapters using different schemes collide on the same
        # canonical verse, we can't trust either chapter, so drop both and retry.
        while True:
            to_canon: dict[Ref, Ref] = {}
            from_canon: dict[Ref, list[Ref]] = {}
            for book, schemes in self.schemes.items():
                for c, s in schemes.items():
                    if s is None:
                        continue
                    for v in range(1, self.counts[book].get(c, 0) + 1):
                        local = (book, c, v)
                        if s == "custom":
                            canon = self.overrides.get(local, local)
                        else:
                            canon = std.to_canon(s, local)
                        to_canon[local] = canon
                        from_canon.setdefault(canon, []).append(local)
            bad: set[tuple[str, int]] = set()
            for locals_ in from_canon.values():
                if len({self.schemes[b][c] for b, c, _ in locals_}) > 1:
                    bad.update((b, c) for b, c, _ in locals_)
            if not bad:
                self.to_canon, self.from_canon = to_canon, from_canon
                return
            for b, c in bad:
                self.schemes[b][c] = None


def load_overrides(abbr: str) -> dict[Ref, Ref]:
    """Per-version corrections from data/overrides/<ABBR>.map (same syntax as
    .vrs mapping lines: `LOCAL = CANONICAL`, canonical in org numbering)."""
    path = DATA / "overrides" / f"{abbr}.map"
    if not path.exists():
        return {}
    _, pairs = _read_vrs(path)
    return dict(pairs)


def load_builtin_counts() -> dict[str, dict[str, dict[int, int]]]:
    """Verse counts observed on bible.com for the chapters where eng/org differ.

    Used when the API's index endpoint isn't available for a version.
    Shape: {abbr: {book: {chapter: verse_count}}}
    """
    raw = json.loads((DATA / "known_counts.json").read_text(encoding="utf-8"))
    out: dict[str, dict[str, dict[int, int]]] = {}
    for abbr, chapters in raw.items():
        for key, n in chapters.items():
            book, ch = key.split(".")
            out.setdefault(abbr, {}).setdefault(book, {})[int(ch)] = n
    return out


def counts_from_index(index: dict) -> dict[str, dict[int, int]]:
    """Convert a /v1/bibles/{id}/index response into {book: {chapter: count}}."""
    out: dict[str, dict[int, int]] = {}
    for book in index.get("books", []):
        bid = book.get("id")
        if bid not in BOOKS:
            continue
        for ch in book.get("chapters") or []:
            try:
                c = int(ch.get("id"))
            except (TypeError, ValueError):
                continue  # intros etc.
            verses = ch.get("verses") or []
            nums = []
            for v in verses:
                vid = v.get("id") if isinstance(v, dict) else v
                if vid is None and isinstance(v, dict):
                    vid = (v.get("passage_id") or v.get("reference") or "").split(".")[-1]
                try:
                    nums.append(int(str(vid).split("-")[-1]))
                except ValueError:
                    pass
            out.setdefault(bid, {})[c] = max(nums, default=len(verses))
    return out
