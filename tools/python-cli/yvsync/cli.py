"""yvsync - keep YouVersion highlights in sync across Bible versions.

  python3 -m yvsync login                 sign in with YouVersion
  python3 -m yvsync check                 test API access for each configured version
  python3 -m yvsync numbering [--version LSG] [--book PSA]
                                          show how verse numbers are mapped
  python3 -m yvsync sync --books JHN      preview what would change (no writes)
  python3 -m yvsync sync --books JHN --apply
  python3 -m yvsync sync --all --apply    whole Bible
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from .api import ApiError, Client, TokenStore
from .auth import login
from .sync import State, Version, apply_plan, chapter_scope, plan_book, read_book
from .versification import (BOOKS, Standard, VersionMap, counts_from_index,
                            load_builtin_counts, load_overrides, ref_str)


class Ctx:
    def __init__(self, config_path: Path):
        if not config_path.exists():
            sys.exit(f"No config at {config_path}. Copy config.example.json to config.json and add your app key.")
        self.config = json.loads(config_path.read_text())
        self.home = config_path.parent / ".yvsync"
        self.tokens = TokenStore(self.home / "tokens.json")
        key = self.config.get("app_key", "")
        if not key or key.startswith("PASTE"):
            self.client = None
        else:
            self.client = Client(key, self.tokens, delay=self.config.get("request_delay", 0.05))

    def need_client(self) -> Client:
        if not self.client:
            sys.exit("Set app_key in config.json first (get one at https://platform.youversion.com).")
        return self.client

    def index_path(self, bible_id: int) -> Path:
        return self.home / "index" / f"{bible_id}.json"

    def versions(self, std: Standard, quiet: bool = False) -> list[Version]:
        builtin = load_builtin_counts()
        out = []
        for v in self.config["versions"]:
            abbr, bid = v["abbr"], int(v["bible_id"])
            p = self.index_path(bid)
            if p.exists():
                counts, source = counts_from_index(json.loads(p.read_text())), "API index"
            elif abbr in builtin:
                counts, source = builtin[abbr], "built-in table"
            else:
                counts, source = {}, f"assumed {v.get('default_numbering', 'eng')} numbering"
            overrides = load_overrides(abbr)
            if overrides:
                source += f" + {abbr} corrections table"
            vm = VersionMap.build(abbr, std, counts, v.get("default_numbering", "eng"), overrides)
            if not quiet:
                print(f"  {abbr:4} (id {bid}): verse numbering from {source}")
            out.append(Version(abbr, bid, vm))
        return out


def cmd_login(ctx: Ctx, args) -> None:
    client = ctx.need_client()
    login(client, ctx.tokens, ctx.config.get("redirect_uri", "http://localhost:8001/callback"),
          open_browser=not args.no_browser)
    print("Signed in. Token saved to", ctx.tokens.path)


def cmd_check(ctx: Ctx, args) -> None:
    client = ctx.need_client()
    signed_in = bool(ctx.tokens.access_token)
    if not signed_in:
        print("Not signed in yet - highlight checks will be skipped. Run `login` first.\n")
    ok_all = True
    for v in ctx.config["versions"]:
        abbr, bid = v["abbr"], int(v["bible_id"])
        print(f"{abbr} (bible_id {bid})")

        def step(label, fn, optional=False):
            nonlocal ok_all
            try:
                detail = fn()
                print(f"   ok    {label}" + (f" - {detail}" if detail else ""))
                return True
            except ApiError as e:
                if optional and e.status in (403, 404):
                    print(f"   n/a   {label} - not licensed to this app key (fine: built-in numbering data is used)")
                    return False
                ok_all = False
                print(f"   FAIL  {label} - HTTP {e.status}: {e.message}")
                return False

        step("Bible metadata", lambda: client.get_bible(bid).get("title", ""), optional=True)

        def index():
            idx = client.get_index(bid)
            p = ctx.index_path(bid)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(idx))
            n = sum(len(c) for c in counts_from_index(idx).values())
            return f"{n} chapters, cached for verse-number detection"
        step("Bible index (verse counts)", index, optional=True)

        if signed_in:
            step("Read highlights (John 3)",
                 lambda: f"{len(client.get_highlights(bid, 'JHN.3'))} highlighted verses")
            if args.write_test:
                step("Write + remove a test highlight (Obadiah 1:21)", lambda: _write_test(client, bid))
    print("\nAll checks passed." if ok_all else "\nSome checks failed - see above.")


def _write_test(client: Client, bid: int) -> str:
    # The API only reads highlights a whole chapter at a time.
    pid = "OBA.1.21"

    def color_now():
        return next((h.get("color") for h in client.get_highlights(bid, "OBA.1")
                     if h.get("passage_id") == pid), None)

    if color_now():
        return "skipped: that verse is already highlighted, not touching it"
    client.set_highlight(bid, pid, "e0e0e0")
    seen = color_now()
    client.delete_highlight(bid, pid)
    after = color_now()
    if not seen:
        raise ApiError(0, "write accepted but highlight not visible on read-back", pid)
    return "wrote, read back, removed" + ("" if not after else " (WARNING: still present after delete)")


def cmd_numbering(ctx: Ctx, args) -> None:
    std = Standard.load()
    versions = ctx.versions(std)
    print()
    books = [args.book] if args.book else BOOKS
    for v in versions:
        if args.version and v.abbr != args.version:
            continue
        lines = []
        for b in books:
            sch = v.vmap.schemes.get(b, {})
            diff = [c for c in sch if std.count("eng", b, c) != std.count("org", b, c)
                    or any(std.eng_to_org.get((b, c, x)) for x in range(1, 3))]
            org = [c for c in diff if sch.get(c) == "org"]
            eng = [c for c in diff if sch.get(c) == "eng"]
            skip = v.vmap.skipped_chapters(b)
            custom = [c for c in sch if sch[c] == "custom"]
            eng = [c for c in eng if c not in custom]
            org = [c for c in org if c not in custom]
            if not (diff or skip or custom) and not args.book:
                continue
            parts = []
            if eng:
                parts.append(f"English numbering in ch. {_ranges(eng)}")
            if org:
                parts.append(f"Hebrew/original numbering in ch. {_ranges(org)}")
            if custom:
                parts.append(f"{v.abbr}-specific numbering in ch. {_ranges(custom)} (corrections table)")
            if skip:
                parts.append(f"CAN'T MAP ch. {_ranges(skip)} (skipped)")
            lines.append(f"  {b}: " + ("; ".join(parts) or "same numbering in both systems"))
        print(f"{v.abbr}:")
        print("\n".join(lines) if lines else "  (nothing notable)")
    if args.book:
        print("\nExample verse mappings (first version -> others):")
        first = versions[0]
        for ch in first.vmap.chapters(args.book)[:200]:
            for vs in (1, first.vmap.counts[args.book][ch]):
                local = (args.book, ch, vs)
                canon = first.vmap.to_canon.get(local)
                if canon is None:
                    continue
                others = ", ".join(
                    f"{o.abbr} " + ("/".join(ref_str(r) for r in o.vmap.from_canon.get(canon, [])) or "-")
                    for o in versions[1:])
                print(f"  {first.abbr} {ref_str(local):11} -> {others}")


def _ranges(nums: list[int]) -> str:
    nums = sorted(nums)
    out, start = [], None
    for i, n in enumerate(nums):
        if start is None:
            start = n
        if i + 1 == len(nums) or nums[i + 1] != n + 1:
            out.append(str(start) if start == n else f"{start}-{n}")
            start = None
    return ", ".join(out)


def cmd_sync(ctx: Ctx, args) -> None:
    client = ctx.need_client()
    if not ctx.tokens.access_token:
        sys.exit("Not signed in - run `python3 -m yvsync login` first.")
    std = Standard.load()
    print("Versions (when colors differ, blanks get the first-listed version's color):")
    versions = ctx.versions(std)
    if args.all:
        books = BOOKS
    elif args.books:
        books = [b.strip().upper() for b in args.books.split(",")]
        bad = [b for b in books if b not in BOOKS]
        if bad:
            sys.exit(f"Unknown book code(s): {', '.join(bad)}. Use USFM codes like GEN, PSA, JHN, 1CO.")
    else:
        sys.exit("Pick --books GEN,PSA,... or --all")
    scope = None
    if args.chapter is not None:
        if len(books) != 1:
            sys.exit("--chapter needs exactly one book, e.g. --books JHN --chapter 3")
        scope = chapter_scope(versions, books[0], args.chapter)
        if not scope[0]:
            sys.exit(f"{books[0]} {args.chapter} doesn't exist in {versions[0].abbr}.")
        where = ", ".join(f"{a} ch. {_ranges(sorted(c))}" for a, c in scope[1].items())
        print(f"Only {books[0]} {args.chapter} (as numbered in {versions[0].abbr}); reading {where}\n")
    state = State(ctx.home / "state.json")
    max_removals = ctx.config.get("max_removals", 25)
    workers = args.workers or ctx.config.get("workers", 4)
    mode = "APPLYING CHANGES" if args.apply else "DRY RUN (nothing will be written; add --apply)"
    print(f"\n{mode}\n")

    totals = Counter()
    removals_so_far = 0
    for book in books:
        try:
            current = read_book(client, versions, book, workers, scope[1] if scope else None)
        except ApiError as e:
            print(f"{book}: SKIPPED - couldn't read highlights ({e}). Nothing changed for this book.")
            totals["books_failed"] += 1
            continue
        plan = plan_book(book, versions, current, state, scope[0] if scope else None)
        sets = Counter(a.version for a in plan.actions if a.op == "set")
        rems = Counter(a.version for a in plan.actions if a.op == "remove")
        skipped = {v.abbr: v.vmap.skipped_chapters(book) for v in versions if v.vmap.skipped_chapters(book)}
        n_hl = {v.abbr: len(current[v.abbr]) for v in versions}
        if plan.actions or plan.conflicts or args.verbose or skipped:
            print(f"{book}: highlights now " + ", ".join(f"{a} {n}" for a, n in n_hl.items()))
            if sets:
                print("   add:    " + ", ".join(f"{a} +{n}" for a, n in sets.items()))
            if rems:
                print("   remove: " + ", ".join(f"{a} -{n}" for a, n in rems.items()))
            for c in plan.conflicts:
                print("   different colors " + c)
            for a, chs in skipped.items():
                print(f"   note: {a} ch. {_ranges(chs)} can't be matched verse-for-verse; not synced")
            if args.verbose:
                for a in plan.actions:
                    col = f" #{a.color}" if a.color else ""
                    print(f"     {a.version:4} {a.op:6} {ref_str(a.local):11}{col}  ({a.reason})")
        totals["conflicts"] += len(plan.conflicts)
        if not args.apply:
            totals["sets"] += sum(sets.values())
            totals["removals"] += sum(rems.values())
        else:
            n_rem = sum(rems.values())
            if n_rem and removals_so_far + n_rem > max_removals and not args.allow_removals:
                print(f"   NOT APPLIED: would remove {n_rem} highlights (limit {max_removals} per run). "
                      "Re-run with --allow-removals if that's intended.")
                totals["books_blocked"] += 1
                continue
            removals_so_far += n_rem
            # Counted only once applied, so a blocked book isn't reported as removed.
            totals["sets"] += sum(sets.values())
            totals["removals"] += n_rem
            errors = apply_plan(client, versions, plan, state)
            for e in errors:
                print("   error: " + e)
            totals["errors"] += len(errors)

    print("\nSummary: "
          + (f"{totals['sets']} highlights added/updated, {totals['removals']} removed, " if args.apply
             else f"{totals['sets']} highlights to add/update, {totals['removals']} to remove, ")
          + f"{totals['conflicts']} verses with different colors (each version keeps its own)"
          + (f", {totals['books_failed']} books skipped (read errors)" if totals["books_failed"] else "")
          + (f", {totals['books_blocked']} books blocked by removal limit" if totals["books_blocked"] else "")
          + (f", {totals['errors']} write errors" if totals["errors"] else ""))
    if not args.apply:
        print("Dry run only. Re-run with --apply to make these changes.")


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="yvsync", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", default="config.json", type=Path)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("login", help="sign in with YouVersion")
    s.add_argument("--no-browser", action="store_true")
    s.set_defaults(fn=cmd_login)

    s = sub.add_parser("check", help="test API access for each version")
    s.add_argument("--write-test", action="store_true",
                   help="also write and remove a test highlight on Obadiah 1:21 (only if it isn't highlighted)")
    s.set_defaults(fn=cmd_check)

    s = sub.add_parser("numbering", help="show verse-number mapping (works offline)")
    s.add_argument("--version")
    s.add_argument("--book")
    s.set_defaults(fn=cmd_numbering)

    s = sub.add_parser("sync", help="sync highlights (dry run unless --apply)")
    s.add_argument("--books", help="comma-separated USFM book codes, e.g. JHN,PSA,ROM")
    s.add_argument("--chapter", type=int, help="only this chapter of the (single) book, numbered as in the first listed version")
    s.add_argument("--all", action="store_true", help="all 66 books")
    s.add_argument("--apply", action="store_true", help="actually write changes")
    s.add_argument("--allow-removals", action="store_true")
    s.add_argument("--workers", type=int)
    s.add_argument("-v", "--verbose", action="store_true")
    s.set_defaults(fn=cmd_sync)

    args = p.parse_args(argv)
    ctx = Ctx(args.config.resolve())
    args.fn(ctx, args)
