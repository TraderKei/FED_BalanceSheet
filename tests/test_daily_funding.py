import unittest
from scripts.ingest import normalize_funding_daily

class DailyFundingTests(unittest.TestCase):
    def test_dates_missing_and_zero_are_preserved(self):
        rows=normalize_funding_daily({'2026-11-02':4.0},{'2026-11-02':3.88},{'2026-11-02':3.9},{'2026-11-03':{'value':0,'operationIds':['a']}})
        self.assertEqual([r['date'] for r in rows],['2026-11-02','2026-11-03'])
        self.assertEqual(rows[0]['sofrIorbSpreadBp'],10)
        self.assertEqual(rows[0]['effrIorbSpreadBp'],-2)
        self.assertIsNone(rows[0]['standingRepoUsage'])
        self.assertEqual(rows[1]['standingRepoUsage'],0)
        self.assertIsNone(rows[1]['sofrIorbSpreadBp'])
        self.assertIsNone(rows[1]['iorb'])
