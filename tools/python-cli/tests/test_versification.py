import unittest

from yvsync.versification import (BOOKS, Standard, VersionMap, load_builtin_counts,
                                  load_overrides, parse_ref, ref_str)

STD = Standard.load()
KNOWN = load_builtin_counts()
MAPS = {a: VersionMap.build(a, STD, KNOWN.get(a), overrides=load_overrides(a))
        for a in ("NIV", "LSG", "S21")}


def across(ref: str) -> dict[str, list[str]]:
    canon = MAPS["NIV"].to_canon[parse_ref(ref)]
    return {a: [ref_str(r) for r in m.from_canon.get(canon, [])] for a, m in MAPS.items()}


class TestMapping(unittest.TestCase):
    # Each pair below was checked against the verse text on bible.com.
    def test_verified_pairs(self):
        cases = {
            "EXO.22.1": {"LSG": ["EXO.22.1"], "S21": ["EXO.21.37"]},
            "1SA.24.1": {"LSG": ["1SA.24.2"], "S21": ["1SA.24.2"]},
            "1SA.21.1": {"LSG": ["1SA.21.1"], "S21": ["1SA.21.2"]},
            "MAL.4.5": {"LSG": ["MAL.4.5"], "S21": ["MAL.3.23"]},
            "2CO.13.14": {"LSG": ["2CO.13.13"], "S21": ["2CO.13.13"]},
            "PSA.51.1": {"LSG": ["PSA.51.3"], "S21": ["PSA.51.3"]},
            "JHN.3.16": {"LSG": ["JHN.3.16"], "S21": ["JHN.3.16"]},
        }
        for niv, want in cases.items():
            got = across(niv)
            for a, refs in want.items():
                self.assertEqual(got[a], refs, f"NIV {niv} -> {a}")

    def test_lsg_corrections_table(self):
        # LSG numbers these chapters its own way; each pair checked on bible.com.
        cases = {
            "JOB.41.1": ["JOB.40.20"],
            "JOB.39.1": ["JOB.39.4"],
            "JOB.40.6": ["JOB.40.1"],
            "ECC.11.9": ["ECC.12.1"],
            "ECC.12.1": ["ECC.12.3"],
            "JOB.34.37": [],          # merged into LSG 34:36
            "MRK.9.50": ["MRK.9.50", "MRK.9.51"],
        }
        for niv, want in cases.items():
            self.assertEqual(across(niv)["LSG"], want, niv)

    def test_nothing_skipped(self):
        for abbr, m in MAPS.items():
            for b in BOOKS:
                self.assertEqual(m.skipped_chapters(b), [], f"{abbr} {b}")

    def test_round_trip_every_verse(self):
        # Every mapped verse must come back to itself.
        for abbr, m in MAPS.items():
            for local, canon in m.to_canon.items():
                self.assertIn(local, m.from_canon[canon], f"{abbr} {ref_str(local)}")

    def test_no_cross_scheme_collisions(self):
        for abbr, m in MAPS.items():
            for canon, locals_ in m.from_canon.items():
                schemes = {m.schemes[b][c] for b, c, _ in locals_}
                self.assertEqual(len(schemes), 1, f"{abbr} {ref_str(canon)}")

    def test_niv_has_every_book(self):
        for b in BOOKS:
            self.assertTrue(MAPS["NIV"].chapters(b), b)

    def test_s21_chapter_sets(self):
        self.assertEqual(MAPS["S21"].chapters("JOL"), [1, 2, 3, 4])
        self.assertEqual(MAPS["S21"].chapters("MAL"), [1, 2, 3])
        self.assertEqual(MAPS["LSG"].chapters("MAL"), [1, 2, 3, 4])


if __name__ == "__main__":
    unittest.main()
