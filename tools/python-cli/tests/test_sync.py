import tempfile
import unittest
from pathlib import Path

from yvsync.api import ApiError
from yvsync.sync import State, Version, apply_plan, chapter_scope, plan_book, read_book
from yvsync.versification import (Standard, VersionMap, load_builtin_counts, load_overrides,
                                  parse_ref)

STD = Standard.load()
KNOWN = load_builtin_counts()
IDS = {"AMP": 1588, "NIV": 111, "LSG": 93, "S21": 152}  # config order: AMP decides blanks
VERSIONS = [Version(a, i, VersionMap.build(a, STD, KNOWN.get(a), overrides=load_overrides(a)))
            for a, i in IDS.items()]


class FakeClient:
    """In-memory stand-in for the YouVersion highlights API."""

    def __init__(self):
        self.store: dict[int, dict[str, str]] = {i: {} for i in IDS.values()}
        self.fail_reads: set[tuple[int, str]] = set()
        self.reject_writes: set[tuple[int, str]] = set()
        self.writes = 0

    def hl(self, abbr, ref, color):
        self.store[IDS[abbr]][ref] = color

    def get_highlights(self, bible_id, passage_id):
        if (bible_id, passage_id) in self.fail_reads:
            raise ApiError(503, "boom", passage_id)
        prefix = passage_id + "."
        return [{"bible_id": bible_id, "passage_id": p, "color": c}
                for p, c in self.store[bible_id].items() if p.startswith(prefix)]

    def set_highlight(self, bible_id, passage_id, color):
        if (bible_id, passage_id) in self.reject_writes:
            raise ApiError(422, "verse not in this version", passage_id)
        self.writes += 1
        self.store[bible_id][passage_id] = color

    def delete_highlight(self, bible_id, passage_id):
        self.writes += 1
        self.store[bible_id].pop(passage_id, None)


class TestSync(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = State(Path(self.tmp.name) / "state.json")
        self.api = FakeClient()

    def tearDown(self):
        self.tmp.cleanup()

    def run_sync(self, book, apply=True):
        current = read_book(self.api, VERSIONS, book, workers=2)
        plan = plan_book(book, VERSIONS, current, self.state)
        if apply:
            apply_plan(self.api, VERSIONS, plan, self.state)
        return plan

    def colors(self, ref_by_version):
        return {a: self.api.store[IDS[a]].get(r) for a, r in ref_by_version.items()}

    def test_first_sync_copies_with_renumbering(self):
        self.api.hl("NIV", "MAL.4.5", "ffe066")
        self.api.hl("S21", "PSA.51.3", "a3d9ff")  # = English Psalm 51:1
        self.run_sync("MAL")
        self.run_sync("PSA")
        self.assertEqual(self.colors({"AMP": "MAL.4.5", "LSG": "MAL.4.5", "S21": "MAL.3.23"}),
                         {"AMP": "ffe066", "LSG": "ffe066", "S21": "ffe066"})
        self.assertEqual(self.colors({"NIV": "PSA.51.1", "AMP": "PSA.51.1", "LSG": "PSA.51.3"}),
                         {"NIV": "a3d9ff", "AMP": "a3d9ff", "LSG": "a3d9ff"})

    def test_second_run_is_a_no_op(self):
        self.api.hl("LSG", "JHN.3.16", "ffe066")
        self.run_sync("JHN")
        writes = self.api.writes
        plan = self.run_sync("JHN")
        self.assertEqual(plan.actions, [])
        self.assertEqual(self.api.writes, writes)

    def test_removal_propagates_after_first_sync(self):
        self.api.hl("NIV", "JHN.3.16", "ffe066")
        self.run_sync("JHN")
        self.api.store[IDS["AMP"]].pop("JHN.3.16")  # user un-highlights in AMP
        self.run_sync("JHN")
        for a in IDS:
            self.assertNotIn("JHN.3.16", self.api.store[IDS[a]], a)

    def test_color_change_propagates(self):
        self.api.hl("NIV", "JHN.1.1", "ffe066")
        self.run_sync("JHN")
        self.api.hl("S21", "JHN.1.1", "ff9999")
        self.run_sync("JHN")
        for a in IDS:
            self.assertEqual(self.api.store[IDS[a]]["JHN.1.1"], "ff9999", a)

    def test_different_colors_keep_own_and_fill_blanks_with_amp(self):
        self.api.hl("NIV", "ROM.8.28", "ffe066")
        self.api.hl("AMP", "ROM.8.28", "ff9999")
        plan = self.run_sync("ROM")
        self.assertEqual(len(plan.conflicts), 1)
        self.assertEqual(self.colors({a: "ROM.8.28" for a in IDS}),
                         {"AMP": "ff9999", "NIV": "ffe066", "LSG": "ff9999", "S21": "ff9999"})
        self.assertEqual(self.run_sync("ROM").actions, [])  # settled

    def test_existing_highlight_never_recolored_on_first_sync(self):
        self.api.hl("NIV", "JHN.1.1", "ffe066")
        self.api.hl("LSG", "JHN.1.1", "a3d9ff")
        self.run_sync("JHN")
        self.assertEqual(self.colors({a: "JHN.1.1" for a in IDS}),
                         {"AMP": "ffe066", "NIV": "ffe066", "LSG": "a3d9ff", "S21": "ffe066"})

    def test_removal_leaves_versions_with_their_own_color(self):
        self.api.hl("AMP", "JHN.1.1", "ff9999")
        self.api.hl("NIV", "JHN.1.1", "ffe066")
        self.run_sync("JHN")                        # LSG, S21 get AMP's pink
        self.api.store[IDS["AMP"]].pop("JHN.1.1")   # user removes it in AMP
        self.run_sync("JHN")
        self.assertEqual(self.colors({a: "JHN.1.1" for a in IDS}),
                         {"AMP": None, "NIV": "ffe066", "LSG": None, "S21": None})

    def test_recolor_only_follows_synced_copies(self):
        self.api.hl("AMP", "JHN.1.1", "ff9999")
        self.api.hl("NIV", "JHN.1.1", "ffe066")
        self.run_sync("JHN")
        self.api.hl("AMP", "JHN.1.1", "a3d9ff")     # recolor in AMP
        self.run_sync("JHN")
        self.assertEqual(self.colors({a: "JHN.1.1" for a in IDS}),
                         {"AMP": "a3d9ff", "NIV": "ffe066", "LSG": "a3d9ff", "S21": "a3d9ff"})

    def test_read_failure_skips_whole_book(self):
        self.api.hl("NIV", "JHN.3.16", "ffe066")
        self.run_sync("JHN")
        self.api.store[IDS["NIV"]].pop("JHN.3.16")
        self.api.fail_reads.add((IDS["LSG"], "JHN.3"))
        with self.assertRaises(ApiError):
            self.run_sync("JHN")
        # Nothing removed, because we couldn't see the whole picture.
        self.assertIn("JHN.3.16", self.api.store[IDS["AMP"]])

    def test_rejected_write_is_remembered_not_treated_as_removal(self):
        self.api.hl("NIV", "JHN.3.16", "ffe066")
        self.api.reject_writes.add((IDS["S21"], "JHN.3.16"))
        self.run_sync("JHN")
        self.assertIn("JHN.3.16", self.state.unwritable["S21"])
        plan = self.run_sync("JHN")  # S21 still lacks it; must not delete elsewhere
        self.assertEqual(plan.actions, [])
        self.assertIn("JHN.3.16", self.api.store[IDS["AMP"]])

    def test_job_41_lands_in_each_versions_numbering(self):
        self.api.hl("NIV", "JOB.41.1", "ffe066")
        self.run_sync("JOB")
        self.assertEqual(self.colors({"AMP": "JOB.41.1", "LSG": "JOB.40.20", "S21": "JOB.40.25"}),
                         {"AMP": "ffe066", "LSG": "ffe066", "S21": "ffe066"})

    def test_chapter_scope_only_touches_that_chapter(self):
        self.api.hl("AMP", "MAL.4.5", "ffe066")
        self.api.hl("AMP", "MAL.3.1", "ffe066")
        canon, local = chapter_scope(VERSIONS, "MAL", 4)
        self.assertEqual(local["S21"], {3})
        current = read_book(self.api, VERSIONS, "MAL", 2, local)
        apply_plan(self.api, VERSIONS, plan_book("MAL", VERSIONS, current, self.state, canon), self.state)
        self.assertEqual(self.api.store[IDS["S21"]], {"MAL.3.23": "ffe066"})  # 3:1 untouched

    def test_dry_run_writes_nothing(self):
        self.api.hl("NIV", "JHN.3.16", "ffe066")
        plan = self.run_sync("JHN", apply=False)
        self.assertEqual(len(plan.actions), 3)
        self.assertEqual(self.api.writes, 0)
        self.assertFalse(self.state.path.exists())


if __name__ == "__main__":
    unittest.main()
