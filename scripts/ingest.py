"""Official Fed balance sheet, policy rate, and NY Fed market data ingestion."""
import argparse
import collections
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
H41_URL = 'https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip'
RRP_URL = 'https://markets.newyorkfed.org/api/rp/results/search.json'
SOFR_URL = 'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json'
EFFR_URL = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json'
PRATES_URL = 'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip'
# Initial load: ON RRP daily operations begin 2013-09-23; the first joined
# H.4.1 Wednesday observation is 2013-09-25. H.4.1 alone begins 2002-12-18.
START = '2013-09-23'
FIRST_JOINED_WEDNESDAY = '2013-09-25'
DAY = dt.timedelta(days=1)
NS = {'frb': 'http://www.federalreserve.gov/structure/compact/common', 'common': 'http://www.SDMX.org/resources/SDMXML/schemas/v1_0/common'}
# Exact series IDs: _N.WW levels, excluding _XAW averages and _XCH changes.
SERIES = {
 'totalAssets':'RESPPA_N.WW', 'treasuryGeneralAccount':'RESPPLLDT_N.WW',
 'treasurySecurities':'RESPPALGUO_N.WW', 'mortgageBackedSecurities':'RESPPALGASMO_N.WW',
 'reserveBalances':'RESH4R_N.WW', 'agencyDebt':'RESPPALGAO_N.WW',
 'loans':'RESPPALD_N.WW', 'assetRepurchaseAgreements':'RESPPALGTR_N.WW',
 'centralBankLiquiditySwaps':'RESH4SCS_N.WW', 'unamortizedPremiums':'RESPPALSP_N.WW',
 'unamortizedDiscounts':'RESPPALSD_N.WW', 'msFacilitiesNetPortfolio':'RESPPAAEH_N.WW',
 'primaryCredit':'RESPPALDP_N.WW', 'otherCreditExtensions':'RESPPALDC_N.WW',
 'securitiesHeldOutright':'RESPPALG_N.WW', 'reverseRepoTotal':'RESPPLLR_N.WW',
 'reverseRepoForeignOfficial':'RESPPLLRF_N.WW', 'reverseRepoOthers':'RESPPLLRD_N.WW',
 'currencyInCirculation':'RESTBC_N.WW', 'federalReserveNotes':'RESPPLLN_N.WW',
 'totalCapital':'RESPPLC_N.WW', 'totalLiabilities':'RESPPLL_N.WW',
 'totalLiabilitiesAndCapital':'RESPPL_N.WW', 'foreignOfficialDeposits':'RESPPLLDF_N.WW',
 'otherDeposits':'RESPPLLDO_N.WW', 'termDeposits':'RESPPLLDA_N.WW',
 'deferredAvailability':'RESPPLLC_N.WW', 'otherLiabilitiesAccrued':'RESPPLLO_N.WW',
 'bills':'RESPPALGUOB_N.WW', 'nominalNotesBonds':'RESPPALGUOMN_N.WW',
 'tipsPrincipal':'RESPPALGUOMI_N.WW', 'inflationCompensation':'RESPPALGUOMC_N.WW',
 'goldCertificate':'RESPPAG_N.WW', 'sdrCertificate':'RESPPAS_N.WW',
 'coin':'RESPPAC_N.WW', 'itemsInCollection':'RESPPAI_N.WW',
 'bankPremises':'RESPPAP_N.WW', 'foreignCurrencyAssets':'RESPPAOF_N.WW',
 'otherAssetsReported':'RESPPAO_N.WW'
}
COMPONENTS = ['treasurySecurities','mortgageBackedSecurities','agencyDebt','loans','assetRepurchaseAgreements','centralBankLiquiditySwaps','unamortizedPremiums','unamortizedDiscounts','msFacilitiesNetPortfolio','otherAssetItems']
OTHER_ASSETS = ['goldCertificate','sdrCertificate','coin','itemsInCollection','bankPremises','foreignCurrencyAssets','otherAssetsReported']
OTHER_LIABS = ['foreignOfficialDeposits','otherDeposits','termDeposits','deferredAvailability','otherLiabilitiesAccrued']
LIABS = ['reserveBalances','treasuryGeneralAccount','reverseRepoTotal','federalReserveNotes','otherLiabilities','totalCapital']

def finite(value):
    return isinstance(value, (int,float)) and not isinstance(value,bool) and math.isfinite(value)

def nullable_sum(values):
    return sum(values) if all(finite(v) for v in values) else None

def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_bytes(content if isinstance(content,bytes) else content.encode('utf-8'))
    os.replace(tmp,path)

def download(url, path, cache=False):
    if cache and path.exists():
        return path.read_bytes()
    request = urllib.request.Request(url, headers={'User-Agent':'FED-BalanceSheet/1.0 (public data dashboard)', 'Accept':'*/*'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=60) as response:
                data=response.read()
            atomic_write(path,data)
            return data
        except Exception:
            if attempt==2: raise
            time.sleep(2**attempt)

def read_h41(path):
    by_id={v:k for k,v in SERIES.items()}
    series,metadata={},{}
    prepared=None
    with zipfile.ZipFile(path) as archive:
        xml_name=next(n for n in archive.namelist() if n.lower().endswith('_data.xml'))
        with archive.open(xml_name) as stream:
            for _,element in ET.iterparse(stream,events=['end']):
                if element.tag.endswith('}Prepared') and prepared is None:
                    prepared=element.text
                if not element.tag.endswith('}Series'): continue
                a=element.attrib; sid=a.get('SERIES_NAME')
                if sid in by_id:
                    key=by_id[sid]
                    if key in series: raise ValueError('Duplicate series: '+sid)
                    desc=element.find('.//common:AnnotationText',NS).text
                    if a.get('CURRENCY')!='USD' or a.get('UNIT_MULT')!='1000000' or a.get('SERIESTYPE')!='L' or 'Wednesday level' not in desc:
                        raise ValueError('Unexpected observation basis / unit: '+sid)
                    observations={}
                    for obs in element.findall('frb:Obs',NS):
                        date=obs.get('TIME_PERIOD')
                        if date in observations: raise ValueError('Duplicate date: '+sid+' '+date)
                        raw=obs.get('OBS_VALUE');status=obs.get('OBS_STATUS')
                        value=None if status=='NA' or raw in (None,'','-999999') else float(raw)
                        if value is not None and not math.isfinite(value): raise ValueError('Non-finite value')
                        observations[date]=int(value) if value is not None and value.is_integer() else value
                    series[key]=observations
                    metadata[key]={'seriesId':sid,'description':desc,'unit':'USD millions','basis':'Wednesday level','source':'Board of Governors of the Federal Reserve System, H.4.1'}
                element.clear()
    missing=set(SERIES)-set(series)
    if missing: raise ValueError('Missing required series: '+str(sorted(missing)))
    return series,metadata,prepared

def read_rrp(payloads):
    operations={}; rejected=collections.Counter()
    for payload in payloads:
        if not isinstance(payload.get('repo',{}).get('operations'),list): raise ValueError('NY Fed response schema changed')
        for operation in payload['repo']['operations']:
            if operation.get('operationType')!='Reverse Repo':
                rejected['nonReverseRepo']+=1;continue
            if str(operation.get('term','')).lower()!='overnight':
                rejected['nonOvernight']+=1;continue
            if operation.get('auctionStatus')!='Results':
                rejected['notResults']+=1;continue
            if operation.get('settlementDate')!=operation.get('operationDate'):
                raise ValueError('Unexpected ON RRP settlement date')
            amount=operation.get('totalAmtAccepted')
            if not finite(amount) or amount<0: raise ValueError('Invalid accepted amount')
            oid=operation.get('operationId')
            if not oid: raise ValueError('Missing operation ID')
            if oid in operations and operations[oid]!=operation: raise ValueError('Conflicting duplicate operation '+oid)
            operations[oid]=operation
    daily=collections.defaultdict(list)
    for op in operations.values(): daily[op['operationDate']].append(op)
    return {date:{'value':sum(o['totalAmtAccepted'] for o in ops)/1_000_000,'operationIds':[o['operationId'] for o in ops]} for date,ops in daily.items()},dict(rejected)


def read_reference_rate(payload, rate_type):
    records=payload.get('refRates')
    if not isinstance(records,list): raise ValueError('NY Fed reference rate schema changed: '+rate_type)
    result={}
    for record in records:
        if record.get('type')!=rate_type: raise ValueError('Unexpected reference rate type')
        date=record.get('effectiveDate');value=record.get('percentRate')
        if not isinstance(date,str) or not finite(value) or value<0 or value>100: raise ValueError('Invalid reference rate')
        if date in result: raise ValueError('Duplicate reference rate date: '+date)
        result[date]=value
    return result


def read_iorb(path):
    with zipfile.ZipFile(path) as archive:
        xml_name=next(n for n in archive.namelist() if n.lower().endswith('_data.xml'))
        with archive.open(xml_name) as stream:
            for _,element in ET.iterparse(stream,events=['end']):
                if not element.tag.endswith('}Series') or element.get('SERIES_NAME')!='RESBM_N.D':
                    continue
                if element.get('UNIT')!='Percent' or element.get('UNIT_MULT')!='1':
                    raise ValueError('Unexpected IORB unit')
                values={}
                for obs in element.findall('frb:Obs',NS):
                    date=obs.get('TIME_PERIOD');raw=obs.get('OBS_VALUE')
                    if date in values: raise ValueError('Duplicate IORB date: '+date)
                    if obs.get('OBS_STATUS')=='NA' or raw in (None,'','-999999'): continue
                    value=float(raw)
                    if not finite(value) or value<0 or value>100: raise ValueError('Invalid IORB rate')
                    values[date]=value
                if not values: raise ValueError('IORB series is empty')
                return values
    raise ValueError('IORB series RESBM_N.D is missing')


def read_standing_repo(payloads):
    operations={};rejected=collections.Counter()
    for payload in payloads:
        records=payload.get('repo',{}).get('operations')
        if not isinstance(records,list): raise ValueError('NY Fed repo schema changed')
        for operation in records:
            if operation.get('operationType')!='Repo':
                rejected['nonRepo']+=1;continue
            if str(operation.get('term','')).lower()!='overnight':
                rejected['nonOvernight']+=1;continue
            if operation.get('auctionStatus')!='Results':
                rejected['notResults']+=1;continue
            if 'small value exercise' in str(operation.get('note','')).lower():
                rejected['smallValueExercise']+=1;continue
            if operation.get('settlementDate')!=operation.get('operationDate'):
                raise ValueError('Unexpected standing repo settlement date')
            amount=operation.get('totalAmtAccepted')
            if not finite(amount) or amount<0: raise ValueError('Invalid standing repo amount')
            oid=operation.get('operationId');date=operation.get('operationDate')
            if not oid or not isinstance(date,str): raise ValueError('Missing standing repo identity')
            if oid in operations and operations[oid]!=operation: raise ValueError('Conflicting duplicate standing repo '+oid)
            operations[oid]=operation
    daily=collections.defaultdict(list)
    for operation in operations.values():daily[operation['operationDate']].append(operation)
    return {date:{'value':sum(op['totalAmtAccepted'] for op in ops)/1_000_000,'operationIds':[op['operationId'] for op in ops]} for date,ops in daily.items()},dict(rejected)

def normalize(series,rrp,sofr=None,effr=None,iorb=None,standing_repo=None):
    sofr=sofr or {};effr=effr or {};iorb=iorb or {};standing_repo=standing_repo or {}
    dates=sorted(d for d,v in series['totalAssets'].items() if d>=START and finite(v))
    if not dates: raise ValueError('No H.4.1 observations')
    if dates[0] != FIRST_JOINED_WEDNESDAY: raise ValueError('Initial H.4.1 Wednesday coverage changed: '+dates[0])
    first=dt.date.fromisoformat(dates[0]);last=dt.date.fromisoformat(dates[-1]);rows=[]
    for i in range((last-first).days//7+1):
        date=(first+dt.timedelta(weeks=i)).isoformat()
        if dt.date.fromisoformat(date).weekday()!=2: raise ValueError('Non-Wednesday date')
        row={'date':date,**{key:observations.get(date) for key,observations in series.items()}}
        row['onRrp']=rrp.get(date,{}).get('value')
        row['onRrpOperationIds']=rrp.get(date,{}).get('operationIds',[])
        row['sofr']=sofr.get(date)
        row['effr']=effr.get(date)
        row['iorb']=iorb.get(date)
        row['sofrIorbSpreadBp']=round((row['sofr']-row['iorb'])*100,4) if finite(row['sofr']) and finite(row['iorb']) else None
        row['effrIorbSpreadBp']=round((row['effr']-row['iorb'])*100,4) if finite(row['effr']) and finite(row['iorb']) else None
        row['standingRepoUsage']=standing_repo.get(date,{}).get('value')
        row['standingRepoOperationIds']=standing_repo.get(date,{}).get('operationIds',[])
        row['netLiquidity']=(row['totalAssets']-row['treasuryGeneralAccount']-row['onRrp']) if all(finite(row[k]) for k in ['totalAssets','treasuryGeneralAccount','onRrp']) else None
        row['assetMixOther']=(row['totalAssets']-row['treasurySecurities']-row['mortgageBackedSecurities']) if all(finite(row[k]) for k in ['totalAssets','treasurySecurities','mortgageBackedSecurities']) else None
        # Source components, never force the accounting sum to match with an invented residual.
        row['otherAssetItems']=nullable_sum([row[k] for k in OTHER_ASSETS])
        row['otherLiabilities']=nullable_sum([row[k] for k in OTHER_LIABS])
        summed=nullable_sum([row[k] for k in COMPONENTS])
        row['assetReconciliationDifference']=row['totalAssets']-summed if finite(summed) and finite(row['totalAssets']) else None
        summed=nullable_sum([row[k] for k in LIABS])
        row['liabilityReconciliationDifference']=row['totalAssets']-summed if finite(summed) and finite(row['totalAssets']) else None
        if row['netLiquidity'] is None: row['missingReason']='No same-Wednesday NY Fed overnight operation or missing H.4.1 input; no carry-forward.'
        rows.append(row)
    return rows

def validate(rows):
    seen=set();bridges=0
    for row in rows:
        if row['date'] in seen: raise ValueError('Duplicate normalized date')
        seen.add(row['date'])
        for key,value in row.items():
            if key in SERIES or key in ['onRrp','netLiquidity','assetMixOther','otherAssetItems','otherLiabilities','sofr','effr','iorb','sofrIorbSpreadBp','effrIorbSpreadBp','standingRepoUsage']:
                if value is not None and not finite(value): raise ValueError('Non-numeric normalized field '+key)
        if row['netLiquidity'] is not None and abs(row['netLiquidity']-(row['totalAssets']-row['treasuryGeneralAccount']-row['onRrp']))>1e-6: raise ValueError('Net liquidity mismatch')
        for rate,spread in [('sofr','sofrIorbSpreadBp'),('effr','effrIorbSpreadBp')]:
            expected=round((row[rate]-row['iorb'])*100,4) if finite(row.get(rate)) and finite(row.get('iorb')) else None
            if row.get(spread)!=expected: raise ValueError('Funding spread mismatch: '+row['date'])
    by_date={r['date']:r for r in rows}
    for row in rows:
        for weeks in (1,4,13,52):
            start=by_date.get((dt.date.fromisoformat(row['date'])-dt.timedelta(weeks=weeks)).isoformat())
            if start and finite(start['netLiquidity']) and finite(row['netLiquidity']):
                change=row['netLiquidity']-start['netLiquidity']
                parts=(row['totalAssets']-start['totalAssets'])-(row['treasuryGeneralAccount']-start['treasuryGeneralAccount'])-(row['onRrp']-start['onRrp'])
                if abs(change-parts)>1e-6: raise ValueError('Bridge mismatch')
                bridges+=1
    latest=rows[-1]
    if latest['netLiquidity'] is None: raise ValueError('Latest Wednesday cannot be joined; preserve last valid snapshot')
    if abs(latest['totalAssets']-latest['totalLiabilitiesAndCapital'])>5: raise ValueError('Latest Table 5 total mismatch')
    for field in ['assetReconciliationDifference','liabilityReconciliationDifference']:
        if latest[field] is None or abs(latest[field])>5: raise ValueError('Latest source reconciliation failed: '+field+' '+str(latest[field]))
    treasury=sum(latest[k] for k in ['bills','nominalNotesBonds','tipsPrincipal','inflationCompensation'])
    if abs(treasury-latest['treasurySecurities'])>5: raise ValueError('Treasury drill-down mismatch')
    return {
      'rowCount':len(rows),'startDate':rows[0]['date'],'endDate':latest['date'],'duplicateDates':0,
      'netLiquidityMissingDates':[r['date'] for r in rows if r['netLiquidity'] is None],
      'missingByField':{k:sum(r[k] is None for r in rows) for k in [*SERIES,'onRrp','netLiquidity']},
      'bridgesValidated':bridges,'roundingToleranceMillions':5,
      'latestAssetDifferenceMillions':latest['assetReconciliationDifference'],
      'latestLiabilityDifferenceMillions':latest['liabilityReconciliationDifference'],
      'latestTreasuryDifferenceMillions':latest['treasurySecurities']-treasury,
      'onRrpVsH41OthersDifferences':[{'date':r['date'],'differenceMillions':round(r['onRrp']-r['reverseRepoOthers'],6)} for r in rows if finite(r['onRrp']) and finite(r['reverseRepoOthers']) and abs(r['onRrp']-r['reverseRepoOthers'])>1],
      'assetBreakdownUnavailableBefore':next((r['date'] for r in rows if r['assetReconciliationDifference'] is not None),None),
      'fundingMissingByField':{k:sum(r.get(k) is None for r in rows) for k in ['sofr','effr','iorb','sofrIorbSpreadBp','effrIorbSpreadBp','standingRepoUsage']}
    }

def run(root=ROOT,reuse_raw=False):
    root=Path(root)
    fetched=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    # Every run preserves original responses and HTTP provenance in its own raw directory.
    stamp=fetched.replace(':','').replace('-','')
    raw=root/'data'/'raw'/stamp;raw.mkdir(parents=True,exist_ok=True)
    cached=None
    if reuse_raw:
        candidates=sorted((root/'data'/'raw').glob('*/h41.zip'))
        if candidates: cached=candidates[-1]
        elif (root/'data'/'raw'/'h41-release-discovery.zip').exists(): cached=root/'data'/'raw'/'h41-release-discovery.zip'
    if cached: atomic_write(raw/'h41.zip',cached.read_bytes())
    else: download(H41_URL,raw/'h41.zip')
    print('H.4.1 XML downloaded',flush=True)
    series,series_meta,prepared=read_h41(raw/'h41.zip')
    latest=max(d for d,v in series['totalAssets'].items() if finite(v))
    manifests=[{'id':'h41','url':H41_URL,'path':str((raw/'h41.zip').relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256((raw/'h41.zip').read_bytes()).hexdigest()}]
    payloads=[]
    for year in range(int(START[:4]),int(latest[:4])+1):
        start=max(START,f'{year}-01-01');end=min(latest,f'{year}-12-31')
        query=urllib.parse.urlencode({'startDate':start,'endDate':end,'operationTypes':'Reverse Repo','term':'overnight'})
        url=RRP_URL+'?'+query;path=raw/f'onrrp-{year}.json'
        prior=sorted((root/'data'/'raw').glob(f'*/onrrp-{year}.json')) if reuse_raw else []
        if prior: data=prior[-1].read_bytes();atomic_write(path,data)
        else: data=download(url,path)
        payload=json.loads(data)
        # The API can return Repo operations despite the filter. Validate/filter response fields below.
        ops=payload.get('repo',{}).get('operations',[])
        if any(not start<=o.get('operationDate','')<=end for o in ops): raise ValueError('API returned dates outside requested range')
        payloads.append(payload)
        manifests.append({'id':f'onrrp-{year}','url':url,'path':str(path.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'returnedOperations':len(ops)})
        print(f'NY Fed {year}: {len(ops)} operations',flush=True)
    rrp,rejected=read_rrp(payloads)
    funding_rates={}
    for rate_type,url in [('SOFR',SOFR_URL),('EFFR',EFFR_URL)]:
        query=urllib.parse.urlencode({'startDate':'2021-07-28','endDate':latest})
        source_url=url+'?'+query;path=raw/f'{rate_type.lower()}.json'
        prior=sorted((root/'data'/'raw').glob(f'*/{rate_type.lower()}.json')) if reuse_raw else []
        if prior: data=prior[-1].read_bytes();atomic_write(path,data)
        else: data=download(source_url,path)
        funding_rates[rate_type]=read_reference_rate(json.loads(data),rate_type)
        manifests.append({'id':rate_type.lower(),'url':source_url,'path':str(path.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'observations':len(funding_rates[rate_type])})
        print(f'{rate_type}: {len(funding_rates[rate_type])} daily rates',flush=True)
    iorb_path=raw/'prates.zip'
    prior=sorted((root/'data'/'raw').glob('*/prates.zip')) if reuse_raw else []
    if prior: atomic_write(iorb_path,prior[-1].read_bytes())
    else: download(PRATES_URL,iorb_path)
    iorb=read_iorb(iorb_path)
    manifests.append({'id':'iorb','url':PRATES_URL,'path':str(iorb_path.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(iorb_path.read_bytes()).hexdigest(),'seriesId':'RESBM_N.D','observations':len(iorb)})
    print(f'IORB: {len(iorb)} daily rates',flush=True)
    repo_payloads=[]
    for year in range(2021,int(latest[:4])+1):
        start=max('2021-07-28',f'{year}-01-01');end=min(latest,f'{year}-12-31')
        query=urllib.parse.urlencode({'startDate':start,'endDate':end,'operationTypes':'Repo'})
        url=RRP_URL+'?'+query;path=raw/f'standing-repo-{year}.json'
        prior=sorted((root/'data'/'raw').glob(f'*/standing-repo-{year}.json')) if reuse_raw else []
        if prior: data=prior[-1].read_bytes();atomic_write(path,data)
        else: data=download(url,path)
        payload=json.loads(data);ops=payload.get('repo',{}).get('operations',[])
        if any(not start<=o.get('operationDate','')<=end for o in ops): raise ValueError('Repo API returned dates outside requested range')
        repo_payloads.append(payload)
        manifests.append({'id':f'standing-repo-{year}','url':url,'path':str(path.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'returnedOperations':len(ops)})
        print(f'Standing repo {year}: {len(ops)} candidate operations',flush=True)
    standing_repo,repo_rejected=read_standing_repo(repo_payloads)
    rows=normalize(series,rrp,funding_rates['SOFR'],funding_rates['EFFR'],iorb,standing_repo)
    quality=validate(rows);quality['filteredOperations']=rejected;quality['filteredStandingRepoOperations']=repo_rejected
    release=prepared[:10]
    meta={'status':'actual','observationDate':rows[-1]['date'],'releaseDate':release,'fetchedAt':fetched,'frequency':'weekly','unit':'USD millions','observationBasis':'wednesday_level','source':'Board of Governors of the Federal Reserve System, H.4.1 and IORB + Federal Reserve Bank of New York ON RRP, SOFR, EFFR, and standing repo','sourceUrl':'https://www.federalreserve.gov/releases/h41/'+release.replace('-','')+'/','onRrpSourceUrl':'https://www.newyorkfed.org/markets/desk-operations/reverse-repo','historyStart':rows[0]['date'],'rawManifest':str((raw/'manifest.json').relative_to(root)).replace('\\','/'),'rawReused':reuse_raw}
    provenance={'sources':manifests,'seriesMap':series_meta,'onRrp':{'endpoint':RRP_URL,'filters':{'operationType':'Reverse Repo','term':'Overnight','auctionStatus':'Results'},'field':'totalAmtAccepted','inputUnit':'USD','outputUnit':'USD millions','conversion':'divide by 1,000,000','join':'operationDate = H.4.1 Wednesday, no carry-forward; sum distinct operation IDs on same date'},'derived':{'netLiquidity':'totalAssets - treasuryGeneralAccount - onRrp','assetMixOther':'totalAssets - treasurySecurities - mortgageBackedSecurities','otherAssetItems':' + '.join(OTHER_ASSETS),'otherLiabilities':' + '.join(OTHER_LIABS)},'notes':['Unavailable and discontinued SDMX observations remain null, including pre-inception Main Street facility observations.','Pre-2020 other credit facilities are not forced into the current asset breakdown; missing coverage remains N/A.','Table 5 uses Federal Reserve notes net of Bank holdings, not Table 1 currency in circulation.','H.4.1 amounts are rounded to USD millions; 5 million tolerance is used for reported sums.','NY Fed overnight operations may span multiple calendar days on holidays; filter term=Overnight, not termCalenderDays=1.']}
    provenance['funding']={'sofr':SOFR_URL,'effr':EFFR_URL,'iorb':{'url':PRATES_URL,'seriesId':'RESBM_N.D'},'standingRepo':{'url':RRP_URL,'filters':{'operationType':'Repo','term':'Overnight','auctionStatus':'Results','smallValueExercise':'excluded'},'field':'totalAmtAccepted','inputUnit':'USD','outputUnit':'USD millions'},'join':'Effective date or operation date equals the H.4.1 Wednesday; no carry-forward','spreads':'(SOFR or EFFR minus IORB) × 100 basis points'}
    provenance['derived'].update({'sofrIorbSpreadBp':'(sofr - iorb) × 100','effrIorbSpreadBp':'(effr - iorb) × 100'})
    snapshot={'meta':meta,'history':rows,'quality':quality,'provenance':provenance}
    encoded=json.dumps(snapshot,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    atomic_write(raw/'manifest.json',json.dumps({'fetchedAt':fetched,'sources':manifests},ensure_ascii=False,indent=2))
    atomic_write(root/'data'/'normalized'/f'h41-{release}.json',encoded)
    atomic_write(root/'data'/'normalized'/'latest.json',encoded)
    # One atomic JS bundle works under file:// without fetch/CORS or a running server.
    atomic_write(root/'assets'/'actual-data.js','/* Official-source snapshot; generated by scripts/ingest.py. */\nwindow.FED_SNAPSHOT = '+encoded+';\n')
    atomic_write(root/'data'/'quality-report.json',json.dumps(quality,ensure_ascii=False,indent=2))
    print(json.dumps({'observationDate':meta['observationDate'],'releaseDate':release,'rows':len(rows),'latest':{k:rows[-1][k] for k in ['totalAssets','treasuryGeneralAccount','onRrp','netLiquidity','reserveBalances','sofr','effr','iorb','sofrIorbSpreadBp','effrIorbSpreadBp','standingRepoUsage']},'missingNetLiquidity':len(quality['netLiquidityMissingDates']),'assetDifference':quality['latestAssetDifferenceMillions'],'liabilityDifference':quality['latestLiabilityDifferenceMillions']},ensure_ascii=False),flush=True)
    return snapshot

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--reuse-raw',action='store_true')
    args=parser.parse_args();run(args.root,args.reuse_raw)
