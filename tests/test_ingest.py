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
        sources={s['id']:ROOT/s['path'] for s in manifest['sources']}
        cls.h41=sources['h41']
        cls.rrp_paths=[p for key,p in sources.items() if key.startswith('onrrp-')]
        cls.repo_paths=[p for key,p in sources.items() if key.startswith('standing-repo-')]
        cls.sofr_path=sources['sofr'];cls.effr_path=sources['effr'];cls.iorb_path=sources['iorb']

    def test_every_row_matches_retained_official_xml_and_operations(self):
        series,metadata,prepared=ingest.read_h41(self.h41)
        rrp,_=ingest.read_rrp([json.loads(p.read_text()) for p in self.rrp_paths])
        sofr=ingest.read_reference_rate(json.loads(self.sofr_path.read_text()),'SOFR')
        effr=ingest.read_reference_rate(json.loads(self.effr_path.read_text()),'EFFR')
        iorb=ingest.read_iorb(self.iorb_path)
        repo,_=ingest.read_standing_repo([json.loads(p.read_text()) for p in self.repo_paths])
        rebuilt=ingest.normalize(series,rrp,sofr,effr,iorb,repo)
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

    def test_funding_sources_join_on_effective_or_operation_wednesday(self):
        latest=self.by_date['2026-10-28']
        self.assertEqual((latest['sofr'],latest['effr'],latest['iorb']),(3.94,3.88,3.90))
        self.assertEqual((latest['sofrIorbSpreadBp'],latest['effrIorbSpreadBp']),(4.0,-2.0))
        self.assertEqual(latest['standingRepoUsage'],6.0)
        self.assertEqual(latest['standingRepoUsage'],sum(
            op['totalAmtAccepted'] for path in self.repo_paths
            for op in json.loads(path.read_text())['repo']['operations']
            if op.get('operationDate')=='2026-10-28' and op.get('operationType')=='Repo'
            and op.get('term')=='Overnight' and op.get('auctionStatus')=='Results'
            and 'small value exercise' not in str(op.get('note','')).lower()
        )/1_000_000)
        self.assertIsNone(self.by_date['2020-10-28']['iorb'])
        self.assertIsNone(self.by_date['2020-10-28']['sofrIorbSpreadBp'])

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

    def test_standing_repo_excludes_exercises_and_preserves_zero(self):
        op={'operationId':'a','operationType':'Repo','term':'Overnight','auctionStatus':'Results','operationDate':'2026-10-28','settlementDate':'2026-10-28','totalAmtAccepted':0,'note':''}
        payload={'repo':{'operations':[op,{**op,'operationId':'b','totalAmtAccepted':6_000_000},{**op,'operationId':'c','note':'Small Value Exercise (SVE)','totalAmtAccepted':10_000_000},{**op,'operationId':'d','term':'Term'},{**op,'operationId':'e','operationType':'Reverse Repo'}]}}
        daily,rejected=ingest.read_standing_repo([payload,payload])
        self.assertEqual(daily['2026-10-28']['value'],6)
        self.assertEqual(len(daily['2026-10-28']['operationIds']),2)
        self.assertEqual(rejected['smallValueExercise'],2)

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
