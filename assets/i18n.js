/* Shared translation table: this is the single source used by the UI and CSV. */
(function (root) {
  const rows = [
    ['title','연준 대차대조표','FED Balance Sheet'],
    ['v2Title','미국 연준 유동성 대시보드','U.S. Fed Liquidity Dashboard'],
    ['workspace','미국 유동성 모니터','US LIQUIDITY MONITOR'],
    ['overview','유동성 개요','Liquidity overview'],
    ['weekly','주간 · 수요일 잔액','Weekly · Wednesday levels'],
    ['asOf','관측일','As of'],['release','발표일','Released'],
    ['mock','샘플 데이터','Mock data'],
    ['mockNote','화면 개발용 가상 시계열입니다. 실제 공표 수치가 아닙니다.','Synthetic series for UI development. Not published financial data.'],
    ['refresh','새로고침','Refresh'],['export','CSV 다운로드','Export CSV'],
    ['dark','다크','Dark'],['light','화이트','White'],['theme','테마','Theme'],['language','언어','Language'],
    ['netLiquidity','순유동성','Net liquidity'],['proxy','제품 정의 대용지표','Product-defined proxy'],
    ['proxyNote','총자산 − TGA − ON RRP. 공식 연준 지표 또는 은행 지급준비금과 다르며 시장가격 예측 신호가 아닙니다.','Total assets − TGA − ON RRP. Not an official Fed measure, bank reserves, or a market-price signal.'],
    ['current','현재 잔액','Current level'],['1w','1주 변화','1-week change'],['4w','4주 변화','4-week change'],['13w','13주 변화','13-week change'],['52w','전년 대비','Year-over-year'],
    ['6m','6개월','6M'],['1y','1년','1Y'],['2y','2년','2Y'],['5y','5년','5Y'],['max','전체','Max'],
    ['range','차트 기간','Chart range'],['period','기여도 기간','Contribution period'],['custom','직접 선택','Custom'],
    ['start','시작일','Start date'],['end','종료일','End date'],['apply','적용','Apply'],
    ['pick','차트에서 두 날짜 선택','Pick two chart dates'],['pickHint','차트에서 시작일과 종료일을 차례로 선택하세요. 방향키와 Enter로도 선택할 수 있습니다.','Choose a start and end on the chart. Arrow keys and Enter also work.'],
    ['invalidDates','시작일 이전의 종료일은 선택할 수 없습니다. 두 날짜 모두 수요일 관측일이어야 합니다.','End must follow start. Both dates must be observed Wednesdays.'],
    ['bridge','같은 기간 순유동성 변화 기여도','Same-period change bridge'],
    ['bridgeNote','수식상의 변화 기여도이며 실제 시장 자금 유입액을 의미하지 않습니다.','Arithmetic contributions, not actual flows into financial markets.'],
    ['totalAssets','총자산','Total assets'],['treasuryGeneralAccount','재무부 일반계정 · TGA','Treasury General Account · TGA'],['onRrp','익일물 역레포 · ON RRP','Overnight reverse repos · ON RRP'],
    ['tgaShort','TGA','TGA'],['rrpShort','ON RRP','ON RRP'],['netChange','순유동성 변화','Net liquidity change'],
    ['contribution','순유동성 기여','Net liquidity contribution'],['increase','증가 기여','Positive contribution'],['decrease','감소 기여','Negative contribution'],['unchanged','변화 없음','Unchanged'],
    ['reconciled','대사 일치','Reconciled'],['mismatch','대사 차이','Reconciliation difference'],
    ['drivers','총자산 내부 변동','Within total assets'],['expand','세부 항목 펼치기','Expand details'],['collapse','접기','Collapse'],
    ['treasurySecurities','미 국채','US Treasuries'],['mortgageBackedSecurities','주택저당증권 · MBS','Mortgage-backed securities · MBS'],['mbsShort','MBS','MBS'],
    ['agencyDebt','기관채','Agency debt'],['loans','대출','Loans'],['assetRepurchaseAgreements','자산 측 RP','Asset-side repo'],['centralBankLiquiditySwaps','중앙은행 유동성 스와프','Central bank liquidity swaps'],
    ['unamortizedPremiums','미상각 프리미엄','Unamortized premiums'],['unamortizedDiscounts','미상각 할인','Unamortized discounts'],['msFacilitiesNetPortfolio','MS 시설 순포트폴리오','MS facilities net portfolio'],['otherAssetItems','기타 자산 항목','Other asset items'],
    ['assetMixOther','기타·회계 조정','Other / accounting adjustments'],['securities','보유증권','Securities'],['credit','단기 신용공급','Short-term credit'],['accounting','기타·회계 항목','Other / accounting items'],
    ['driversNote','절대 변화량 순 · 동일 기간 · USD billions','Sorted by absolute change · Same period · USD billions'],
    ['liquidityDrivers','TGA / ON RRP 추이','TGA / ON RRP trends'],['independent','동일 날짜 · 독립 세로축','Shared dates · Independent scales'],
    ['crossCheck','지급준비금 교차 확인','Reserve balance cross-check'],['reserveBalances','은행 지급준비금','Bank reserve balances'],
    ['sameDirection','선택 기간 순유동성과 같은 방향','Same direction as the proxy over this period'],['differentDirection','선택 기간 순유동성과 방향 상이','Different direction from the proxy over this period'],
    ['crossNote','방향이 다르면 통화·해외기관 역레포·기타 부채를 함께 확인합니다.','When directions differ, review currency, foreign-official RRP and other liabilities.'],
    ['funding','자금조달 여건','Funding conditions'],['notConnected','데이터 미연결','Not connected'],['fundingNote','SOFR−IORB · EFFR−IORB · 상설 레포 이용액','SOFR−IORB · EFFR−IORB · Standing repo usage'],
    ['assetMix','자산 구성','Asset composition'],['mixNote','총자산 대비 금액·비중 · 기타는 잔차','Amounts / share of total assets · Other is a residual'],
    ['balanceSheet','대차대조표 요약','Balance sheet summary'],['assets','자산','Assets'],['liabilities','부채·자본','Liabilities & capital'],
    ['fullTable','전체 표 보기','View full table'],['compactTable','간략히 보기','View less'],['bills','단기 국채','Bills'],['nominalNotesBonds','명목 중장기 국채','Nominal notes & bonds'],['tipsPrincipal','물가연동국채 원금','TIPS principal'],['inflationCompensation','인플레이션 보상','Inflation compensation'],
    ['currencyInCirculation','유통 통화','Currency in circulation'],['reverseRepoTotal','역레포 전체 · H.4.1','Total reverse repos · H.4.1'],['reverseRepoForeignOfficial','해외 공식기관 역레포','Foreign-official reverse repos'],['reverseRepoOthers','기타 역레포 · H.4.1','Other reverse repos · H.4.1'],['otherLiabilities','기타 부채','Other liabilities'],['totalCapital','자본','Capital'],['total','합계','Total'],
    ['rrpNote','ON RRP는 뉴욕 연은 거래값이며 H.4.1 전체 역레포와 범위가 다릅니다.','ON RRP is a New York Fed operation amount; its scope differs from H.4.1 total reverse repos.'],
    ['pulse','유동성 / 정책 맥락','Liquidity / policy pulse'],['rising','순유동성 대용지표 상승','Net liquidity proxy rising'],['falling','순유동성 대용지표 하락','Net liquidity proxy falling'],
    ['largest','최대 절대 기여 항목','Largest absolute contributor'],['pulseNote','수식상의 분해입니다. 정책성 매입·긴급대출 여부와 시장 반응은 별도 자료가 필요합니다.','An arithmetic decomposition. Policy purchases, emergency lending and market responses require separate evidence.'],
    ['stress','스트레스 모니터','Stress watch'],['primaryCredit','프라이머리 크레딧','Primary credit'],['otherCreditExtensions','기타 신용공여','Other credit extensions'],['normal','보통','Normal'],['elevated','주의','Elevated'],['high','높음','High'],['insufficient_data','관측 부족','Insufficient data'],['percentile','52주 백분위','52-week percentile'],['stressNote','52주 중 26개 이상 관측 시 분류 · ≥95 주의 / ≥99 높음 · 위기 판단 지표가 아닙니다.','Requires ≥26 observations in 52 weeks · ≥95 elevated / ≥99 high · Not a crisis diagnosis.'],
    ['source','출처','Source'],['sourceNote','설계상 원천: 연준 H.4.1 / 뉴욕 연은 ON RRP. 현재 화면은 가상 데이터입니다.','Intended sources: Federal Reserve H.4.1 / New York Fed ON RRP. This screen uses synthetic data.'],
    ['updated','마지막 확인','Last checked'],['observation','관측일','Observation date'],['expected','예상 갱신','Expected update'],['expectedValue','공식 주간 발표 이후','After the official weekly release'],
    ['loading','샘플 데이터를 불러오는 중입니다.','Loading sample data.'],['empty','선택 기간에 관측치가 없습니다.','No observations in this range.'],['reset','범위 초기화','Reset range'],['unavailable','데이터 없음','Data unavailable'],
    ['stale','데이터가 오래되었습니다. 마지막 정상 스냅샷을 표시합니다.','Data is stale. Showing the last valid snapshot.'],['error','불러오지 못했습니다. 마지막 정상 스냅샷을 표시합니다.','Refresh failed. Showing the last valid snapshot.'],['retry','다시 시도','Retry'],['partial','보조 지표 일부가 누락되었습니다.','Some supporting series are unavailable.'],
    ['demoState','화면 상태 미리보기','Preview screen state'],['ready','기본','Default'],['loadingState','로딩','Loading'],['partialState','부분 누락','Partial'],['staleState','오래된 데이터','Stale'],['errorState','오류','Error'],['emptyState','빈 데이터','Empty'],
    ['translations','한·영 변환 테이블','KO / EN translation table'],['search','문구 검색','Search translations'],['key','키','Key'],['korean','한국어','Korean'],['english','영어','English'],['close','닫기','Close'],['downloadTable','언어 테이블 다운로드','Download language table'],
    ['chartHelp','방향키로 관측일 탐색','Arrow keys to explore observations'],['zoomHelp','마우스로 기간을 드래그해 확대 · 방향키로 관측일 탐색','Drag a date range to zoom · Arrow keys to explore observations'],['resetZoom','확대 초기화','Reset zoom'],['wow','전주 대비','Week over week'],['selected','선택 구간','Selected interval'],['observations','개 관측치','observations'],['refreshDone','샘플 데이터를 다시 불러왔습니다.','Sample data reloaded.']
  ];
  const table = Object.fromEntries(rows.map(([key,ko,en]) => [key,{ko,en}]));
  const actualTranslations = {
  "actual": {
    "ko": "공식 데이터",
    "en": "Official data"
  },
  "actualNote": {
    "ko": "연준 H.4.1 · 뉴욕 연은 ON RRP · 동일 수요일 잔액",
    "en": "Federal Reserve H.4.1 · NY Fed ON RRP · Matched Wednesday levels"
  },
  "reloadSnapshot": {
    "ko": "저장 데이터 다시 읽기",
    "en": "Reload saved data"
  },
  "fileModeNote": {
    "ko": "저장된 공식 데이터입니다. 최신 수집은 RefreshData.cmd, 화면에서 수집하려면 StartDashboard.cmd를 실행하세요.",
    "en": "Saved official-source data. Run RefreshData.cmd to collect again, or StartDashboard.cmd to enable in-app collection."
  },
  "sourceNote": {
    "ko": "출처: Board of Governors of the Federal Reserve System, H.4.1 / Federal Reserve Bank of New York ON RRP.",
    "en": "Source: Board of Governors of the Federal Reserve System, H.4.1 / Federal Reserve Bank of New York ON RRP."
  },
  "updated": {
    "ko": "수집 시각",
    "en": "Collected at"
  },
  "loading": {
    "ko": "공식 데이터를 불러오는 중입니다. 재수집 시 잠시 기다려 주세요.",
    "en": "Loading official data. Source collection may take a moment."
  },
  "refreshDone": {
    "ko": "공식 데이터 수집과 검증을 완료했습니다.",
    "en": "Official data collected and validated."
  },
  "snapshotReloaded": {
    "ko": "저장된 공식 데이터를 다시 읽었습니다.",
    "en": "Saved official-source data reloaded."
  },
  "refreshFailed": {
    "ko": "갱신에 실패했습니다. 마지막 정상 데이터를 유지합니다.",
    "en": "Refresh failed. The last valid snapshot has been retained."
  },
  "federalReserveNotes": {
    "ko": "연준권 순액 · 은행 보유분 제외",
    "en": "Federal Reserve notes · net of Bank holdings"
  },
  "missingObservations": {
    "ko": "결측 관측일",
    "en": "Missing observations"
  },
  "missingDates": {
    "ko": "결측 날짜 확인",
    "en": "Inspect missing dates"
  },
  "noCarry": {
    "ko": "0 또는 인접일 값으로 대체하지 않음",
    "en": "No zero fill or adjacent-date substitution"
  },
  "missingPeriodNote": {
    "ko": "선택한 시작일 또는 종료일의 필수 입력이 없어 기여도를 계산할 수 없습니다.",
    "en": "Required input is missing on a selected endpoint; contributions cannot be computed."
  },
  "historicalGap": {
    "ko": "과거 시설 등 미포함 항목",
    "en": "Historical facilities / unmapped items"
  },
  "historicalGapNote": {
    "ko": "과거 대출시설 등 현재 분해표에 없는 자산은 대사 차액으로 표시합니다. 차액을 기타 자산에 임의로 채우지 않습니다.",
    "en": "Historical facilities outside the current breakdown remain visible as reconciliation differences; they are not forced into Other assets."
  },
  "roundingReconciled": {
    "ko": "공표 반올림 범위 내 일치",
    "en": "Within published rounding tolerance"
  },
  "roundingNote": {
    "ko": "공표 단위는 백만 달러이며 합계 대사의 허용오차는 5백만 달러입니다.",
    "en": "Reported amounts are in USD millions; reconciliation tolerance is USD 5 million."
  },
  "sourceDetails": {
    "ko": "출처·데이터 검증",
    "en": "Sources & data validation"
  },
  "sourceMethod": {
    "ko": "H.4.1은 XML의 수요일 잔액을 사용합니다. ON RRP는 뉴욕 연은 익일물 거래의 accepted amount(USD)를 백만 달러로 변환해 동일 거래일에만 결합합니다.",
    "en": "H.4.1 uses Wednesday levels from XML. ON RRP uses NY Fed overnight accepted amounts in USD, divided by 1,000,000 and joined only on the same operation date."
  },
  "seriesMapping": {
    "ko": "원천 계열 매핑 보기",
    "en": "Inspect source series mapping"
  },
  "qualityReport": {
    "ko": "데이터 품질 검사 결과",
    "en": "Data quality results"
  },
  "previewOnly": {
    "ko": "개발용 화면 상태 미리보기 모드입니다. 데이터 자체는 공식 수집값입니다.",
    "en": "Screen-state preview mode. Underlying values are official-source observations."
  },
  "otherLiabilities": {
    "ko": "기타 예금·부채 합계",
    "en": "Other deposits & liabilities"
  },
  "goldCertificate": {
    "ko": "금 증서 계정",
    "en": "Gold certificate account"
  },
  "sdrCertificate": {
    "ko": "SDR 증서 계정",
    "en": "SDR certificate account"
  },
  "coin": {
    "ko": "주화",
    "en": "Coin"
  },
  "itemsInCollection": {
    "ko": "추심 중 항목",
    "en": "Items in process of collection"
  },
  "bankPremises": {
    "ko": "은행 건물",
    "en": "Bank premises"
  },
  "foreignCurrencyAssets": {
    "ko": "외화표시 자산",
    "en": "Foreign currency assets"
  },
  "otherAssetsReported": {
    "ko": "공표 기타 자산",
    "en": "Reported other assets"
  },
  "otherLiabilitiesAccrued": {
    "ko": "기타 부채·미지급 배당",
    "en": "Other liabilities & accrued dividends"
  },
  "foreignOfficialDeposits": {
    "ko": "해외 공식기관 예금",
    "en": "Foreign-official deposits"
  },
  "otherDeposits": {
    "ko": "기타 예금",
    "en": "Other deposits"
  },
  "termDeposits": {
    "ko": "정기 예금",
    "en": "Term deposits"
  },
  "deferredAvailability": {
    "ko": "이연 지급 항목",
    "en": "Deferred availability cash items"
  },
  "totalLiabilities": {
    "ko": "부채 합계",
    "en": "Total liabilities"
  },
  "totalLiabilitiesAndCapital": {
    "ko": "부채·자본 합계",
    "en": "Total liabilities and capital"
  },
  "securitiesHeldOutright": {
    "ko": "보유증권 합계",
    "en": "Securities held outright"
  }
};
  Object.assign(table,actualTranslations);
  root.FED_I18N = table;
  if (typeof module !== 'undefined') module.exports = table;
})(typeof window !== 'undefined' ? window : globalThis);
