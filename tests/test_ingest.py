import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import ingest

class IngestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot=json.loads((ROOT/'data/normalized/latest.json').read_text(encoding='utf-8'))
        cls.rows=cls.snapshot['history'];cls.by_date={r['date']:r for r in cls.rows}
        manifest=json.loads((ROOT/cls.snapshot['meta']['rawManifest']).read_text(encoding='utf-8'))
        cls.h41=ROOT/manifest['sources'][0]['path']
        cls.rrp_paths=[ROOT/s['path'] for s in manifest['sources'][1:]]

    def test_every_row_matches_retained_official_xml_and_operations(self):
        series,metadata,prepared=ingest.read_h41(self.h41)
        rrp,_=ingest.read_rrp([json.loads(p.read_text()) for p in self.rrp_paths])
        rebuilt=ingest.normalize(series,rrp)
        self.assertEqual(rebuilt,self.rows)
        for key,m in metadata.items():
            self.assertIn('Wednesday level',m['description'])
            self.assertNotIn('_XAW_',m['seriesId'])
        self.assertEqual(prepared[:10],self.snapshot['meta']['releaseDate'])

    def test_independent_published_release_20261022(self):
        # Federal Reserve published Table 1/5, https://www.federalreserve.gov/releases/h41/20261022/
        latest=self.by_date['2026-10-21']
        self.assertEqual(latest['totalAssets'],6753604)
        self.assertEqual(latest['treasuryGeneralAccount'],945153)
        self.assertEqual(latest['reserveBalances'],2969522)
        self.assertEqual(latest['treasurySecurities'],4572654)
        self.assertEqual(latest['mortgageBackedSecurities'],1895177)
        self.assertEqual(latest['onRrp'],237)
        self.assertEqual(latest['netLiquidity'],5808214)
        self.assertEqual(latest['totalAssets']-self.by_date['2026-10-14']['totalAssets'],-2035)
        self.assertEqual(latest['netLiquidity']-self.by_date['2026-10-14']['netLiquidity'],-61401)

    def test_no_operation_is_not_zero_or_carried_forward(self):
        for date in self.snapshot['quality']['netLiquidityMissingDates']:
            self.assertIsNone(self.by_date[date]['onRrp'])
            self.assertIsNone(self.by_date[date]['netLiquidity'])
            self.assertEqual(self.by_date[date]['onRrpOperationIds'],[])
        self.assertIn('2024-12-25',self.snapshot['quality']['netLiquidityMissingDates'])

    def test_rrp_filters_term_direction_and_uses_usd_not_billions(self):
        op={'operationId':'a','operationType':'Reverse Repo','term':'Overnight','auctionStatus':'Results','operationDate':'2026-10-21','settlementDate':'2026-10-21','termCalenderDays':3,'totalAmtAccepted':237000000}
        payload={'repo':{'operations':[op,{**op,'operationId':'b','operationType':'Repo'},{**op,'operationId':'c','term':'Term'}]}}
        daily,rejected=ingest.read_rrp([payload,payload])
        self.assertEqual(daily['2026-10-21']['value'],237)
        self.assertEqual(daily['2026-10-21']['operationIds'],['a'])
        self.assertEqual(rejected['nonReverseRepo'],2)
        with self.assertRaises(ValueError):ingest.read_rrp([payload,{'repo':{'operations':[{**op,'totalAmtAccepted':1}]}}])

    def test_all_periods_and_latest_source_reconciliation(self):
        quality=ingest.validate(self.rows)
        self.assertGreater(quality['bridgesValidated'],2500)
        self.assertLessEqual(abs(quality['latestAssetDifferenceMillions']),5)
        self.assertLessEqual(abs(quality['latestLiabilityDifferenceMillions']),5)
        self.assertEqual(self.by_date['2026-10-21']['unamortizedDiscounts'],-26309)
        # Differences in older RRP scope are retained, not overwritten with H.4.1 Others.
        self.assertNotEqual(self.by_date['2014-12-31']['onRrp'],self.by_date['2014-12-31']['reverseRepoOthers'])

    def test_invalid_latest_rejected_and_source_null_preserved(self):
        bad=[dict(r) for r in self.rows];bad[-1]['onRrp']=None;bad[-1]['netLiquidity']=None
        with self.assertRaises(ValueError):ingest.validate(bad)
        self.assertIsNone(ingest.nullable_sum([1,None,3]))
        self.assertEqual(ingest.nullable_sum([1,0,-1]),0)

if __name__=='__main__':unittest.main()
