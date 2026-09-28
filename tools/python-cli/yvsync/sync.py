"""Highlight sync across Bible versions.

The snapshot (.yvsync/state.json) remembers, per canonical verse, the color each
version had after the last sync. For every verse we compare each version's
current color with its own snapshot:

  * nothing changed                -> nothing to do
  * one or more versions changed   -> that change is the "new value"
    (if they changed to different colors, the version listed first in the
    config wins)

The new value is then applied to the *other* versions, but existing highlights
are never overwritten with a different color:

  * a version with no highlight on the verse gets it (fill in)
  * a version whose highlight is still the color the sync last left there
    follows a recolor or removal
  * a version with its own, different color keeps it

On the first sync nothing is in the snapshot, so every highlight counts as new:
blanks are filled (first-listed version's color when versions disagree) and
nothing is removed or recolored.

Safety rules:
  * If reading any chapter of a book fails for any version, that whole book is
    skipped. (Otherwise a missing read would look like "highlight removed".)
  * Dry run by default; writes only with apply=True.
  * Removals above `max_removals` per run are refused unless explicitly allowed.
"""

from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from .api import ApiError
from .versification import Ref, VersionMap, parse_ref, ref_str


@dataclass
class Version:
    abbr: str
    bible_id: int
    vmap: VersionMap


@dataclass
class Action:
    version: str
    op: str            # "set" | "remove"
    local: Ref
    color: str | None
    canon: Ref
    reason: str        # "fill" | "recolor" | "remove"


@dataclass
class BookPlan:
    book: str
    actions: list[Action] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    # canon key -> {abbr: color} expected after the actions run
    new_state: dict[str, dict[str, str]] = field(default_factory=dict)
    error: str | None = None
    notes: list[str] = field(default_factory=list)


class State:
    """Per-version snapshot of the colors left by the last sync."""

    def __init__(self, path: Path):
        self.path = path
        self.verses: dict[str, dict[str, str]] = {}   # canon key -> {abbr: color}
        self.unwritable: dict[str, list[str]] = {}     # abbr -> canonical refs the API rejected
        if path.exists():
            d = json.loads(path.read_text())
            self.verses = d.get("verses", {})
            self.unwritable = d.get("unwritable", {})

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "verses": dict(sorted(self.verses.items())),
            "unwritable": self.unwritable,
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, indent=1))
        tmp.replace(self.path)


def _norm(color: str | None) -> str | None:
    return color.lower().lstrip("#") if color else None


def chapter_scope(versions: list[Version], book: str, chapter: int
                  ) -> tuple[set[Ref], dict[str, set[int]]]:
    """Limit a sync to one chapter, numbered as in the first listed version.

    Returns the canonical verses in it, and which local chapters each version
    must read to see them (e.g. English Malachi 4 is chapter 3 in S21).
    """
    first = versions[0].vmap
    canon = {first.to_canon[(book, chapter, v)]
             for v in range(1, first.counts.get(book, {}).get(chapter, 0) + 1)
             if (book, chapter, v) in first.to_canon}
    local = {v.abbr: {r[1] for c in canon for r in v.vmap.from_canon.get(c, [])} for v in versions}
    return canon, local


def read_book(client, versions: list[Version], book: str, workers: int = 4,
              chapters: dict[str, set[int]] | None = None) -> dict[str, dict[Ref, str]]:
    """Fetch every highlight in `book` for each version: {abbr: {local_ref: color}}.

    `chapters` optionally limits which chapters are read per version.
    Raises ApiError if any chapter can't be read.
    """
    jobs = [(v, ch) for v in versions for ch in v.vmap.chapters(book)
            if chapters is None or ch in chapters.get(v.abbr, ())]

    def fetch(job):
        v, ch = job
        return v.abbr, client.get_highlights(v.bible_id, f"{book}.{ch}")

    out: dict[str, dict[Ref, str]] = {v.abbr: {} for v in versions}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for abbr, items in pool.map(fetch, jobs):
            for h in items:
                pid, color = h.get("passage_id"), _norm(h.get("color"))
                if not pid or not color:
                    continue
                try:
                    out[abbr][parse_ref(pid)] = color
                except ValueError:
                    continue  # unexpected passage format; ignore
    return out


def plan_book(book: str, versions: list[Version], current: dict[str, dict[Ref, str]],
              state: State, only: set[Ref] | None = None) -> BookPlan:
    plan = BookPlan(book)
    priority = [v.abbr for v in versions]

    # Canonical view per version. A canonical verse can cover several local
    # verses (e.g. 2 Cor 13:12-13 in English = 13:12 in French); any
    # highlighted one counts.
    canon_colors: dict[str, dict[Ref, str]] = {}
    for v in versions:
        cc: dict[Ref, str] = {}
        for local, color in current[v.abbr].items():
            canon = v.vmap.to_canon.get(local)
            if canon is None:
                plan.notes.append(f"{v.abbr} {ref_str(local)} is in a chapter that can't be mapped; left alone")
                continue
            cc.setdefault(canon, color)
        canon_colors[v.abbr] = cc

    prefix = f"{book}."
    universe: set[Ref] = set()
    for cc in canon_colors.values():
        universe.update(cc)
    universe.update(parse_ref(k) for k in state.verses if k.startswith(prefix))
    if only is not None:
        universe &= only

    for canon in sorted(universe, key=lambda r: (r[1], r[2])):
        key = ref_str(canon)
        prev = state.verses.get(key, {})
        participants = [
            v for v in versions
            if v.vmap.from_canon.get(canon) and key not in state.unwritable.get(v.abbr, [])
        ]
        if not participants:
            continue
        cur = {v.abbr: canon_colors[v.abbr].get(canon) for v in participants}
        result = {a: c for a, c in cur.items() if c}
        changed = {a: c for a, c in cur.items() if c != prev.get(a)}
        if not changed:
            if result:
                plan.new_state[key] = result
            continue

        winner = next(a for a in priority if a in changed)
        target = changed[winner]
        old = prev.get(winner)  # what the winner had before, i.e. the synced color
        if len(set(changed.values())) > 1:
            plan.conflicts.append(
                f"{key}: " + ", ".join(f"{a}={c or 'none'}" for a, c in changed.items())
                + f" -> each keeps its own; blanks get {winner}'s ({target or 'none'})"
            )

        for v in participants:
            a = v.abbr
            if a in changed:
                continue  # a version's own change is never overridden
            have = cur[a]
            synced = have is not None and have == prev.get(a) == old
            if target is None:
                op, reason = ("remove", "remove") if synced else (None, None)
            elif have is None:
                op, reason = "set", "fill"
            elif synced and have != target:
                op, reason = "set", "recolor"
            else:
                op = reason = None
            if op is None:
                continue
            for local in v.vmap.from_canon[canon]:
                lhave = current[a].get(local)
                if op == "remove" and lhave is not None:
                    plan.actions.append(Action(a, "remove", local, None, canon, reason))
                elif op == "set" and lhave != target:
                    plan.actions.append(Action(a, "set", local, target, canon, reason))
            if op == "remove":
                result.pop(a, None)
            else:
                result[a] = target
        plan.new_state[key] = result
    return plan


def apply_plan(client, versions: list[Version], plan: BookPlan, state: State) -> list[str]:
    """Execute the plan and update the snapshot. Returns error messages."""
    by_abbr = {v.abbr: v for v in versions}
    retry: set[str] = set()                       # canon keys to leave for next run
    rejected: dict[str, set[str]] = {}            # canon key -> versions the API refused
    errors: list[str] = []
    for a in plan.actions:
        v = by_abbr[a.version]
        pid = ref_str(a.local)
        key = ref_str(a.canon)
        try:
            if a.op == "set":
                client.set_highlight(v.bible_id, pid, a.color)
            else:
                client.delete_highlight(v.bible_id, pid)
        except ApiError as e:
            errors.append(f"{a.version} {a.op} {pid}: {e}")
            if e.retryable:
                retry.add(key)
            else:
                # The API won't take this verse for this version (e.g. a verse the
                # translation omits). Stop including that version for this verse.
                rejected.setdefault(key, set()).add(a.version)
                lst = state.unwritable.setdefault(a.version, [])
                if key not in lst:
                    lst.append(key)
    for key, colors in plan.new_state.items():
        if key in retry:
            continue  # keep the old snapshot so the next run tries again
        colors = {a: c for a, c in colors.items() if a not in rejected.get(key, ())}
        if colors:
            state.verses[key] = colors
        else:
            state.verses.pop(key, None)
    state.save()
    return errors
