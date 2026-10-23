# FED_BalanceSheet

`FED_BalanceSheet`는 미 연준 대차대조표(H.4.1)를 트레이더와 금융정보 단말 사용자가 빠르게 해석할 수 있도록 제공하는 현대적인 웹형 대시보드 프로젝트다. 이 문서는 제품 범위, 데이터 계약, 화면 구조와 첫 구현 순서를 정의하며, Codex가 별도의 기획 보완 없이 MVP 개발을 시작할 수 있는 수준을 목표로 한다.

## 1. 프로젝트 목표

- Federal Reserve H.4.1 데이터를 수집·정규화해 주간 시계열로 제공한다.
- Net Liquidity 대용지표의 수준·전체 추이·기간별 변화량을 화면의 출발점으로 제공한다.
- 같은 기간의 `Δ총자산 − ΔTGA − ΔON RRP`를 대사하고, 총자산 내부의 주요 변동 항목까지 단계적으로 분석한다.
- 지급준비금과 자금시장 여건을 별도 확인 지표로 제시하고, 자산 구성·정책 및 스트레스 신호는 보조 정보로 제공한다.
- Bloomberg/Reuters 계열 단말의 정보 밀도는 유지하되, 현대적인 웹 UI의 색상·간격·상호작용을 적용한다.
- 초기 버전은 데스크톱 단말을 우선하고 태블릿과 모바일에서는 읽기 가능한 형태로 재배치한다.

### 주요 사용자

- 채권·금리·FX·주식 트레이더
- 거시경제 및 유동성 전략가
- 세일즈, 리서치, 운용 및 리스크 담당자

### 사용자가 10초 안에 답할 수 있어야 하는 질문

1. Net Liquidity 대용지표는 현재 얼마이며, 전체 추이와 1주·4주·13주 변화는 어떠한가?
2. 같은 기간의 순유동성 변화를 `Δ총자산`, `−ΔTGA`, `−ΔON RRP` 중 무엇이 주도했는가?
3. 총자산 변화는 국채·MBS 등 보유증권과 대출·자산 측 RP 등 단기 신용공급 중 어디에서 발생했는가?
4. TGA와 ON RRP의 변화는 일시적인 주간 변동인가, 지속되는 추세인가?
5. 은행 지급준비금과 자금시장 여건도 같은 해석을 뒷받침하는가?
6. 변화가 평상시 수준인가, 스트레스성 유동성 공급 신호인가?

## 2. 데이터 소스 및 이용 원칙

### 우선순위

1. **Primary — FederalReserve.gov H.4.1 직접 수집**
   - 현재 릴리스: `https://www.federalreserve.gov/releases/h41/current/`
   - 데이터 다운로드: `https://www.federalreserve.gov/datadownload/Choose.aspx?rel=h41`
   - Table 1과 Table 5 CSV 또는 전체 SDMX/XML을 수집한다.
   - 화면과 저장 데이터에는 `Source: Board of Governors of the Federal Reserve System, H.4.1`을 표시한다.
2. **Secondary — FRED**
   - 직접 수집 장애 시 검증·백필·교차 확인에 사용한다.
   - FRED API를 고객용 제품에 직접 연동하면 별도의 API 약관, 고지, API 키 및 상표 관련 요건이 적용되므로 기본 운영 경로로 사용하지 않는다.
3. **ON RRP — Federal Reserve Bank of New York 거래 결과**
   - [Reverse Repo Operations](https://www.newyorkfed.org/markets/desk-operations/reverse-repo)에서 익일물 역레포의 일별 accepted amount를 수집한다. 운영용 API는 [Markets Data APIs](https://markets.newyorkfed.org/static/docs/markets-api.html)의 해당 엔드포인트와 이용 조건을 확인한 뒤 어댑터에 지정한다.
   - H.4.1의 수요일 관측일과 같은 날짜의 거래 결과만 주간 시계열에 결합한다. 거래 결과와 H.4.1의 `Reverse repurchase agreements → Others`를 교차 확인하되, 후자를 ON RRP의 영구적인 동의어로 가정하지 않는다.

### 라이선스 메모

- Federal Reserve Board는 별도 표시가 없는 웹사이트 정보를 public domain으로 안내하며 허가 없이 복제·배포할 수 있다고 밝히고 있다. 출처 표시는 권장한다.
- 따라서 H.4.1 원천 수치는 상업 금융정보 서비스에서 재배포 가능한 것으로 설계하되, 로고·제3자 이미지·그래픽은 원천 수치와 구분한다.
- 이 README는 법률 자문이 아니다. 상용 출시 전 최신 정책과 제품 내 고지 문구를 사내 법무가 재확인한다.
- 공식 근거: [Federal Reserve Board disclaimer](https://www.federalreserve.gov/disclaimer.htm), [H.4.1 Data Download Program](https://www.federalreserve.gov/datadownload/Choose.aspx?rel=h41), [FRED API Terms of Use](https://fred.stlouisfed.org/docs/api/terms_of_use.html)

### 수집 형식 전략

- **MVP:** H.4.1 Table 1·Table 5 CSV와 뉴욕 연은 ON RRP 일별 결과를 사용해 빠르게 구현한다.
- **Production:** H.4.1 전체 SDMX/XML 파서와 ON RRP 데이터 어댑터를 분리한다. 원천의 설명 문구나 열 순서가 바뀌어도 series key와 거래 식별자를 기준으로 매핑해야 한다.
- HTML 표 스크래핑은 CSV/XML 장애 시 진단용에만 사용하고 운영 데이터 소스로 삼지 않는다.
- 원본 응답은 변경하지 않고 날짜별 raw snapshot으로 보존하며, 정규화 결과와 분리한다.

> 주의: Board는 Data Download Program의 일부 기능 제거 및 향후 변경을 예고했다. 다운로드 URL이나 CSV 열 위치를 UI 코드에 직접 고정하지 말고 `ingestion adapter → normalizer → dashboard API` 계층으로 분리한다.

## 3. 관측 기준과 데이터 필드 분석

H.4.1 표에는 주간 평균과 수요일 잔액이 함께 존재할 수 있다. KPI와 차트는 비교 가능성을 위해 **수요일 기준 잔액(Wednesday level), 단위 USD millions**로 통일한다. 화면에서는 기본적으로 조 달러(`$T`) 또는 십억 달러(`$B`)로 표시하되 계산과 저장은 원 단위인 million USD를 유지한다.

### 지표 우선순위와 필수 데이터

| 역할 | 내부 키 | 화면명 | 원천 항목 또는 계산식 | 출처 |
|---|---|---|---|---|
| 중심 지표 | `netLiquidity` | Net Liquidity | `totalAssets - treasuryGeneralAccount - onRrp` | 파생값 |
| 1차 기여도 | `totalAssets` | Total Assets | Total assets | H.4.1 Table 5 |
| 1차 기여도 | `treasuryGeneralAccount` | TGA | U.S. Treasury — General Account | H.4.1 Table 1 |
| 1차 기여도 | `onRrp` | ON RRP | Overnight reverse repo accepted amount | 뉴욕 연은 일별 거래 결과 |
| 자산 내부 요인 | `treasurySecurities` | Treasury Securities | U.S. Treasury securities | H.4.1 Table 1 |
| 자산 내부 요인 | `mortgageBackedSecurities` | MBS | Mortgage-backed securities | H.4.1 Table 1 |
| 교차 확인 | `reserveBalances` | Reserve Balances | Reserve balances with Federal Reserve Banks | H.4.1 Table 1 |

`reverseRepoTotal`은 별도 보조 필드로 H.4.1 Table 1의 `Reverse repurchase agreements` 전체 수요일 잔액을 뜻한다. 해외 공식기관 거래가 포함되므로 `onRrp`와 혼용하거나 둘을 동시에 순유동성에서 차감하지 않는다. `reverseRepoForeignOfficial`과 `reverseRepoOthers`도 원천 분해값으로 보존한다. ON RRP 일별 원천값은 십억 달러 단위일 수 있으므로 백만 달러로 변환하고 수요일 관측일을 명시한다.

### 국채 drill-down

| 내부 키 | H.4.1 원천 항목 | 화면명 |
|---|---|---|
| `treasuryBills` | Bills | Bills |
| `treasuryNominalNotesBonds` | Notes and bonds, nominal | Nominal Notes & Bonds |
| `treasuryTipsPrincipal` | Notes and bonds, inflation-indexed | TIPS |
| `treasuryInflationCompensation` | Inflation compensation | Inflation Compensation |

기본 drill-down 차트는 요청 범위인 Bills / Nominal Notes & Bonds / TIPS 세 항목을 표시한다. TIPS의 인플레이션 보상은 합계 대사에 필요하므로 데이터에는 보존하고, UI에서는 툴팁 또는 보조 행으로 제공한다.

### 스트레스 및 정책 보조 필드

`Stress Watch`와 `Liquidity / Policy Pulse`에 사용할 최소 필드다.

| 내부 키 | H.4.1 원천 항목 | 용도 |
|---|---|---|
| `primaryCredit` | Primary credit | Discount Window 사용 급증 탐지 |
| `bankTermFundingProgram` | Bank Term Funding Program | 과거 스트레스 프로그램 이력; 값이 종료돼도 시계열 보존 |
| `otherCreditExtensions` | Other credit extensions | 비정상 신용공급 탐지 |
| `centralBankLiquiditySwaps` | Central bank liquidity swaps | 달러 조달 스트레스 탐지 |
| `securitiesHeldOutright` | Securities held outright | 자산매입·축소 방향 보조 |
| `reverseRepoTotal` | Reverse repurchase agreements | 전체 역레포와 ON RRP 범위 차이 확인 |
| `assetRepurchaseAgreements` | Repurchase agreements | 자산 측 단기 자금공급과 총자산 변화 설명 |
| `loans` | Loans | 할인창구 등 대출과 총자산 변화 설명 |
| `unamortizedPremiums` / `unamortizedDiscounts` | Unamortized premiums / discounts on securities held outright | 국채·MBS 보유액과 총자산 변화의 회계상 차이 설명 |
| `currencyInCirculation` | Currency in circulation | 부채 구성 및 준비금 설명 |

원천 항목이 중단·명칭 변경될 수 있으므로 `series-map.ts`에서 `active`, `validFrom`, `validTo`, `aliases`를 관리한다. 값이 없는 경우 `0`으로 바꾸지 말고 `null`로 저장한다.

## 4. 파생 지표와 계산 규칙

### 변화값

중심 지표와 세 기여 항목에는 1주·4주·13주 변화량을 우선 계산한다. 전년 대비는 보조 비교로 둔다.

```text
Change(h) = value(endDate) - value(startDate), h = 1w | 4w | 13w | 52w
ChangePct(h) = Change(h) / value(startDate) × 100
Net Liquidity Change(h) = Total Assets Change(h) - TGA Change(h) - ON RRP Change(h)
```

- 모든 기간의 기여도는 **동일한 시작·종료 수요일**의 세 원천값으로 계산한다. 일부 항목이 결측이면 기간 합계와 기여도는 `null`/`N/A`로 두며, 다른 시작일의 변화량을 합산하지 않는다.
- 1주는 직전 수요일, 4주·13주·52주는 각각 28·91·364일 전 수요일을 기준으로 한다. 관측 누락 시 다른 날짜로 대체하지 않고 날짜와 결측 사유를 표시한다.
- 변화율의 분모가 0이거나 부호가 바뀌면 퍼센트 대신 절대 변화량을 우선 표시한다. 기여도 비교는 백만/십억 달러의 절대금액으로 한다.
- 값의 상승이 항상 긍정적인 것은 아니므로 카드 색은 단순 양/음이 아니라 지표 의미를 반영한다. 기본 카드 변화값은 중립 색, 해석 신호에만 semantic color를 사용한다.

### Net Liquidity

```text
Net Liquidity = Total Assets - TGA - ON RRP
ΔNet Liquidity = ΔTotal Assets - ΔTGA - ΔON RRP
```

- `Total Assets`는 H.4.1 Table 5, `TGA`는 Table 1의 수요일 잔액, `ON RRP`는 같은 수요일의 뉴욕 연은 일별 accepted amount를 사용한다. 세 입력의 관측일과 단위(USD millions)가 같아야 한다. 주간 평균, 발표일, 다른 날짜의 일별 값을 섞지 않는다.
- 이 값은 시장 유동성을 설명하기 위한 **제품 정의의 proxy**이며 공식 연준 지표나 은행 지급준비금 잔액이 아니다. 지급준비금은 별도 검증 지표로 나란히 보여준다.
- `Δ총자산`, `−ΔTGA`, `−ΔON RRP`는 **수식상의 변화 기여도**다. 위험자산 가격에 대한 인과효과나 실제 시장 유동성 유입액으로 해석하지 않는다. 특히 ON RRP 감소분이 주식시장으로 직접 이동했다고 추론하지 않는다.
- 툴팁: `Product-defined proxy: Federal Reserve total assets less the Treasury General Account and overnight reverse repos. Not the same as bank reserve balances.`
- H.4.1의 전체 역레포를 대신 차감하는 식은 `Total Assets - TGA - Reverse Repo Total`로 별도 이름(`netLiquidityAllRrp`)을 부여한다. 이 대안에는 해외 공식기관 거래가 포함되므로 기본 Net Liquidity와 한 계열로 연결하지 않는다.
- 입력 중 하나라도 없으면 해당 날짜의 결과는 `null`로 처리한다.

2026-09-30 수요일 잔액(USD millions)으로 대사하면 `6,743,031(총자산) - 984,046(TGA) - 11,539(ON RRP) = 5,747,446`이다. 같은 날 전체 역레포는 `361,883`이며 이 중 해외 공식기관 거래는 `350,344`이다. ON RRP 대신 전체 역레포를 차감하는 대안 값은 `5,397,102`로 달라진다. 은행 지급준비금 잔액은 `2,881,686`으로 별도 지표다. 출처: [H.4.1 2026-10-01 릴리스, Table 1·5](https://www.federalreserve.gov/releases/h41/20261001/), [뉴욕 연은 ON RRP 결과](https://www.newyorkfed.org/markets/desk-operations/reverse-repo).

시장 해석에서는 이 수식만으로 자금조달 압력이나 증권시장의 호가 유동성을 판정하지 않는다. 연준은 준비금과 비준비금 부채의 변화를 함께 설명하며, 뉴욕 연은은 준비금 수준과 함께 EFFR·레포 금리의 IORB 대비 움직임을 관찰한다. [연준 대차대조표 설명](https://www.federalreserve.gov/monetarypolicy/bst_frliabilities.htm), [뉴욕 연은 준비금·금리 설명](https://www.newyorkfed.org/newsevents/speeches/2026/per260326).

### 총자산 변화의 원인 분석

```text
ΔTotal Assets = ΔTreasury Securities + ΔAgency Debt + ΔMBS
              + ΔUnamortized Premiums + ΔUnamortized Discounts
              + ΔAsset Repurchase Agreements + ΔLoans
              + ΔCentral Bank Liquidity Swaps
              + ΔMS Facilities Net Portfolio + ΔOther Asset Items
```

- 국채와 MBS를 지속적인 자산매입·축소(QE/QT)의 주요 관찰 항목으로 표시한다. 대출, 자산 측 RP, 중앙은행 유동성 스와프는 단기 자금공급 및 스트레스 변화의 주요 설명 항목으로 표시한다.
- `Other Asset Items`에는 금·SDR 증서, 주화, 추심 중 항목, 은행 건물, 외화표시 자산, 기타 자산을 포함한다. 중앙은행 유동성 스와프와 MS Facilities 순포트폴리오는 별도 항목으로 더해 중복을 피한다.
- 미상각 할인은 원천의 음수 부호를 유지해 더한다. `Securities held outright` 합계를 국채·기관채·MBS와 다시 더하지 않는다. 자산 측 RP와 부채 측 RRP도 구분한다.
- 순유동성 기여도에서 총자산을 펼치면 **같은 기간**의 주요 자산 항목 변화를 waterfall 또는 표로 보여준다. 국채·MBS 등의 증권 변동과 대출·자산 측 RP 등의 단기 자금공급을 분리하며, 총자산 증감과의 나머지 항목 및 반올림 차이를 기록한다.
- 총자산 증가를 자동으로 완화정책으로 분류하지 않는다. 정책성 증권매입·재투자와 시장 스트레스에 대응한 대출·RP 확대는 다른 신호다. QE/QT 명칭은 별도의 정책 결정·기간과 대조한 뒤에만 사용한다.

### Asset Mix

```text
Treasuries share = Treasury Securities / Total Assets
MBS share        = MBS / Total Assets
Asset Mix Other share = max(Total Assets - Treasuries - MBS, 0) / Total Assets
```

- stacked area는 금액 기준을 기본으로 하고, 툴팁에서 비중도 함께 제공한다.
- `assetMixOther`는 Total Assets에서 국채와 MBS를 뺀 잔차로, H.4.1의 `Other assets`나 자산 변화 대사의 `otherAssetItems`와 다른 개념이다. 대사 차이와 회계 조정이 존재하므로 이 잔차를 단순 오류로 취급하지 않는다.

### Liquidity / Policy Pulse

초기 버전은 모델 예측이 아닌 규칙 기반 설명을 제공한다.

- 선택 기간의 `ΔNet Liquidity > 0`: Net liquidity proxy rising; `< 0`: Net liquidity proxy falling.
- 같은 기간의 `ΔTotal Assets`, `−ΔTGA`, `−ΔON RRP`를 비교하고 가장 큰 절대 기여 항목을 한 줄 요약에 사용한다.
- 1주 급변은 4주·13주 변화와 대조한다. 세금 납부일, 재무부 지출·국채 결제일, 월말·분기말과 겹치는 경우 일시적 요인 가능성을 표시하되, 별도 일정 데이터가 없으면 원인을 확정하지 않는다.
- 자산이 늘어도 대출·RP 급증이 동반되면 정책성 증권매입과 다른 스트레스 가능성을 함께 표시한다.

### Stress Watch

MVP 규칙:

- Primary Credit, Other Credit Extensions, Central Bank Liquidity Swaps의 현재값과 WoW를 표시한다.
- 최근 52주 분포가 충분하면 z-score 또는 percentile을 계산한다.
- 52주 관측치가 26개 미만이면 상태를 `insufficient_data`로 둔다.
- 기본 상태: `normal`; 95 percentile 이상: `elevated`; 99 percentile 이상: `high`.
- 0에서 작은 양수로 바뀐 경우 퍼센트 변화 대신 절대 변화량을 보여준다.
- 이는 운용 편의를 위한 경보이며 금융위기 판단이나 투자 신호로 표현하지 않는다.

## 5. UI/UX 구조

### 전체 레이아웃

```text
┌────────────────────────────────────────────────────────────────────┐
│ Header: FED BALANCE SHEET · observation date · source · refresh   │
├────────────────────────────────────────────────────────────────────┤
│ NET LIQUIDITY · current · Δ1W · Δ4W · Δ13W                   │
│ Full-width trend · 2Y default / Max available · hover values      │
├────────────────────────────────────────────────────────────────────┤
│ Same-period change bridge: ΔAssets | −ΔTGA | −ΔON RRP = ΔNL     │
├────────────────────────────────┬───────────────────────────────────┤
│ Total Assets trend / Δ          │ TGA trend · ON RRP trend          │
│ Treasury · MBS · loans · RP Δ   │ independent scales                │
├────────────────────────────────────────────────────────────────────┤
│ Cross-check: reserve balances · funding conditions (if sourced)  │
├────────────────────────────────┬───────────────────────────────────┤
│ Asset Mix + Balance Sheet      │ Stress Watch + policy context     │
└────────────────────────────────┴───────────────────────────────────┘
```

### 최상단: Net Liquidity 주 차트와 변화량

- 현재 잔액과 1주·4주·13주 절대 변화량을 큰 숫자로 표시한다. 전년 대비는 보조 값으로 제공한다. 변화율보다 달러 변화량을 먼저 보여준다.
- 전체 너비의 **독립된 Net Liquidity 시계열**을 기본 2년 범위로 표시하고 6M / 1Y / 2Y / 5Y / Max를 선택할 수 있게 한다. Max는 사용 가능한 전체 이력이다.
- 추이 차트의 선택 범위는 총자산·TGA·ON RRP 원인 차트와 공유한다. 기여도는 기본 1주이며 4주·13주로 바꾸거나 주 차트의 시작·종료 수요일을 직접 선택할 수 있다. 선택 기간의 시작·종료 잔액과 절대·퍼센트 변화량을 보여준다.
- `as of YYYY-MM-DD`와 출처·상태를 헤더에 표시한다. 숫자는 tabular-nums를 적용하고 큰 값은 `$7.12T`, 변화값은 `−$24.6B`처럼 표시한다.
- Net Liquidity는 제품 정의의 대용지표임을 차트 제목과 툴팁에 표시하며, 시장가격 예측 신호로 표현하지 않는다.

### 바로 아래: 같은 기간 순유동성 변화 기여도

- 1주·4주·13주 또는 주 차트에서 선택한 시작·종료일을 대상으로 `Δ총자산`, `−ΔTGA`, `−ΔON RRP`를 waterfall 또는 양·음 기여 막대로 표시한다.
- 세 기여도의 합계가 표시된 `ΔNet Liquidity`와 일치해야 한다. 각 막대에 시작·종료 잔액과 절대 변화량을 볼 수 있게 한다.
- 화면에서 총자산 기여도를 펼치면 국채, MBS, 대출, 자산 측 RP, 스와프, 기타 자산 및 회계 조정의 같은 기간 증감을 확인할 수 있게 한다.

### 원인 패널: 총자산과 주요 변동 항목

- 총자산의 독립 추이와 같은 기간 변화량을 표시한다. 국채·MBS 보유액은 지속적 증권 변화의 핵심 항목으로, 대출·자산 측 RP·스와프는 단기 신용공급 항목으로 분리한다.
- 자산 내부 항목의 기여도 합계와 `ΔTotal Assets`를 대사하고, 표시하지 않은 항목은 `Other asset items`로 남긴다. 증권 원금과 미상각 프리미엄·할인의 부호를 유지한다.
- 보유액 규모가 큰 항목만 고정해서 강조하지 않는다. **선택 기간의 실제 변화 기여도 절댓값**에 따라 원인을 정렬하고, 정책성 증권매입과 긴급 대출 증가의 해석을 구분한다.

### 원인 패널: TGA / ON RRP 변화 추이

- **TGA와 ON RRP를 각각 독립된 선 차트(small multiples)**로 나란히 표시한다. 두 계열의 잔액 규모가 달라도 작은 ON RRP 변화를 읽을 수 있도록 각 차트는 독립적인 세로축을 사용하고, 축 단위와 범위를 명시한다.
- 두 차트의 가로축은 동일한 **H.4.1 수요일 관측일**로 맞춘다. ON RRP는 해당 수요일의 뉴욕 연은 일별 결과를 사용한다. Net Liquidity 주 차트의 기간 선택을 공유한다.
- hover에는 잔액(USD billions), 전주 대비 증감(USD billions), 관측일을 표시한다. 차트 아래에 선택한 기여도 기간의 `−ΔTGA`, `−ΔON RRP`가 순유동성 변화에 미친 방향과 금액을 함께 보여준다.
- 결측값은 선을 끊고 `N/A`로 표시한다. 0으로 채우거나 가장 가까운 다른 날짜의 값을 대입하지 않는다.
- 시각적 축소 시에도 TGA와 ON RRP를 서로 구분된 두 차트로 유지하며, 좁은 화면에서는 세로로 쌓는다. 총자산과 한 축에 겹치거나 이중 세로축으로 표현하지 않는다.
- TGA의 움직임을 설명할 때 세금·재무부 지출·국채 발행과 결제일을 별도 자료로 확인한다. ON RRP 감소분의 행선지를 H.4.1만으로 단정하지 않는다.

### 교차 확인: 은행 지급준비금과 자금조달 여건

- MVP에서는 H.4.1의 은행 지급준비금 잔액·1주·4주·13주 변화를 Net Liquidity 대용지표와 같은 날짜로 비교한다. 방향이 다르면 통화, 해외 공식기관 역레포, 기타 예금·부채 등 대차대조표의 다른 항목을 확인하고 차이를 오류로 단정하지 않는다.
- 자금시장 데이터가 연결되면 SOFR−IORB 또는 EFFR−IORB 스프레드와 상설 레포 이용액을 보조 검증 지표로 제공한다. 금리·시설 이용은 규모 지표와 다른 **자금조달 압력**을 보여주며, 동일한 수요일 또는 명시된 집계 기간으로 맞춘다. 출처: [뉴욕 연은 SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr), [뉴욕 연은 레포 운영 결과](https://www.newyorkfed.org/markets/desk-operations/repo).
- Net Liquidity의 상승만으로 위험자산으로 자금이 유입됐거나 시장 유동성이 개선됐다고 결론내리지 않는다. 실제 매매 유동성과 시장금리·스프레드는 별도 관측 대상이다.

### 보조 정보: Asset Mix stacked area

- Treasuries, MBS, Other를 겹침 없는 stacked area로 표시한다.
- 고정된 색상 매핑을 사용한다: Treasuries=cyan, MBS=violet, Other=slate.
- 툴팁에는 금액과 Total Assets 대비 비중을 함께 표시한다.

### 보조 정보: Balance Sheet Summary

- Assets / Liabilities 두 열의 compact table.
- 핵심 행만 기본 노출하고 `View full table`로 확장한다. 부채의 역레포 총액과 ON RRP는 이름과 출처를 구분한다.
- Treasury 행 클릭 시 Bills / Nominal Notes & Bonds / TIPS drill-down을 펼친다.
- 합계 대사 차이가 허용오차를 넘으면 작은 경고 아이콘과 차액을 표시한다.

### 하단: Policy Pulse / Stress Watch

- 상단의 기여도·교차 확인 결과를 요약하는 문장 1개를 제공한다. 수식상의 기여도와 시장 반응의 인과 해석을 구분한다.
- Primary Credit, Other Credit Extensions, Central Bank Liquidity Swaps의 현재값·변화량과 상태 badge를 제공한다.

### 시각 스타일

- compact, neat, desktop-first web terminal.
- 기본 dark theme. 배경은 navy/charcoal, 패널은 미세한 명도 차이, 테두리는 저대비.
- 숫자와 차트에 집중하고 장식용 gradient, 과도한 glow, 큰 모서리 반경은 피한다.
- 양/음 색상은 색각 이상에서도 구분되도록 아이콘·부호·텍스트를 함께 사용한다.
- 권장 폰트: Inter 또는 Geist, 숫자에는 tabular lining figures.
- 1440px 화면에서 스크롤 전 핵심 상태가 보이는 것을 목표로 한다.

### 참고 이미지

이전 대화에서 생성한 목업을 시각 방향 참고용으로 사용한다.

```text
/mnt/data/a_dark_themed_financial_dashboard_ui_screenshot_o.png
```

이 경로는 이전 ChatGPT 실행환경의 경로일 수 있다. 현재 작업공간에서 파일이 보이지 않으면 구현을 중단하지 말고 위 UI 명세를 기준으로 진행한 뒤, 사용자가 이미지를 다시 첨부하면 색상·간격을 보정한다. 이미지를 그대로 복제하기보다 정보 구조와 밀도, dark terminal 분위기를 참고한다.

## 6. 기술 스택

- React + Next.js(App Router) + TypeScript
- Tailwind CSS
- Recharts
- Zod: ingestion 및 API 응답 런타임 검증
- Vitest: 계산·정규화 단위 테스트
- Testing Library: 핵심 컴포넌트 테스트
- Playwright: 대시보드 smoke test 및 반응형 검증

패키지 매니저는 프로젝트 생성 시 하나만 선택해 lockfile을 유지한다. MVP는 외부 상태관리 도구 없이 Server Components와 작은 client chart component 조합으로 시작한다.

## 7. 제안 파일 구조

```text
.
├─ README.md
├─ package.json
├─ next.config.ts
├─ public/
│  └─ mock/
│     └─ h41-dashboard.json
├─ src/
│  ├─ app/
│  │  ├─ api/h41/route.ts
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components/
│  │  ├─ dashboard-header.tsx
│  │  ├─ kpi-card.tsx
│  │  ├─ kpi-strip.tsx
│  │  ├─ net-liquidity-chart.tsx
│  │  ├─ change-bridge.tsx
│  │  ├─ total-assets-chart.tsx
│  │  ├─ asset-drivers.tsx
│  │  ├─ liquidity-drivers-chart.tsx
│  │  ├─ asset-mix-chart.tsx
│  │  ├─ balance-sheet-summary.tsx
│  │  ├─ treasury-drilldown.tsx
│  │  ├─ liquidity-pulse.tsx
│  │  ├─ stress-watch.tsx
│  │  └─ states/
│  │     ├─ dashboard-skeleton.tsx
│  │     ├─ dashboard-error.tsx
│  │     └─ stale-data-banner.tsx
│  ├─ data/
│  │  ├─ adapters/
│  │  │  ├─ federal-reserve-csv.ts
│  │  │  ├─ federal-reserve-sdmx.ts
│  │  │  ├─ new-york-fed-on-rrp.ts
│  │  │  └─ fred-fallback.ts
│  │  ├─ series-map.ts
│  │  ├─ normalize.ts
│  │  ├─ derive.ts
│  │  └─ validate.ts
│  ├─ lib/
│  │  ├─ format.ts
│  │  ├─ dates.ts
│  │  └─ env.ts
│  └─ types/
│     └─ h41.ts
├─ scripts/
│  └─ ingest-h41.ts
├─ data/
│  ├─ raw/.gitkeep
│  └─ normalized/.gitkeep
└─ tests/
   ├─ normalize.test.ts
   ├─ derive.test.ts
   └─ dashboard.spec.ts
```

`data/raw`는 운영 환경에서 object storage로 대체할 수 있다. 대용량 원본과 비밀키는 Git에 커밋하지 않는다.

## 8. 프런트엔드용 mock JSON 계약

금액 필드는 모두 `USD millions`, 날짜는 ISO `YYYY-MM-DD`다. 프런트엔드는 원천 필드명을 직접 알지 않고 이 계약만 사용한다. 아래 `history`는 1주·4주·13주 비교 기준일을 보여주는 축약 예시이며, 실제 mock 파일에는 최소 104개의 연속된 수요일 관측값과 자산 세부 계열을 넣는다.

```json
{
  "meta": {
    "source": "Federal Reserve Board H.4.1 + Federal Reserve Bank of New York ON RRP",
    "sourceUrl": "https://www.federalreserve.gov/releases/h41/current/",
    "onRrpSourceUrl": "https://www.newyorkfed.org/markets/desk-operations/reverse-repo",
    "observationDate": "2026-08-19",
    "releaseDate": "2026-08-20",
    "frequency": "weekly",
    "observationBasis": "wednesday_level",
    "unit": "USD millions",
    "fetchedAt": "2026-08-20T21:00:00Z",
    "status": "fresh"
  },
  "latest": {
    "totalAssets": { "value": 6630000, "wow": -12400, "wowPct": -0.19, "yoy": -180000, "yoyPct": -2.64 },
    "treasurySecurities": { "value": 4520000, "wow": -4200, "wowPct": -0.09, "yoy": -95000, "yoyPct": -2.06 },
    "mortgageBackedSecurities": { "value": 1930000, "wow": -6100, "wowPct": -0.32, "yoy": -189000, "yoyPct": -8.92 },
    "reserveBalances": { "value": 3200000, "wow": 18000, "wowPct": 0.57, "yoy": -40000, "yoyPct": -1.23 },
    "onRrp": { "value": 20000, "wow": -22000, "wowPct": -52.38, "yoy": -19000, "yoyPct": -48.72 },
    "treasuryGeneralAccount": { "value": 780000, "wow": 35000, "wowPct": 4.7, "yoy": 60000, "yoyPct": 8.33 },
    "netLiquidity": { "value": 5830000, "wow": -25400, "wowPct": -0.43, "change4w": -10000, "change4wPct": -0.17, "change13w": 140000, "change13wPct": 2.46, "yoy": -221000, "yoyPct": -3.65 },
    "reverseRepoTotal": { "value": 310000, "wow": -22000, "wowPct": -6.63, "yoy": -190000, "yoyPct": -38.0 }
  },
  "history": [
    {
      "date": "2026-05-20", "totalAssets": 6570000, "treasurySecurities": 4470000,
      "mortgageBackedSecurities": 1980000, "reserveBalances": 3100000,
      "onRrp": 80000, "treasuryGeneralAccount": 800000, "netLiquidity": 5690000,
      "reverseRepoTotal": 340000, "assetMixOther": 120000,
      "assetComponents": { "agencyDebt": 2000, "unamortizedPremiums": 100000, "unamortizedDiscounts": -25000, "assetRepurchaseAgreements": 500, "loans": 7000, "centralBankLiquiditySwaps": 100, "msFacilitiesNetPortfolio": 800, "otherAssetItems": 34600 }
    },
    {
      "date": "2026-07-22", "totalAssets": 6600000, "treasurySecurities": 4500000,
      "mortgageBackedSecurities": 1950000, "reserveBalances": 3180000,
      "onRrp": 60000, "treasuryGeneralAccount": 700000, "netLiquidity": 5840000,
      "reverseRepoTotal": 320000, "assetMixOther": 150000,
      "assetComponents": { "agencyDebt": 2000, "unamortizedPremiums": 100000, "unamortizedDiscounts": -25000, "assetRepurchaseAgreements": 500, "loans": 7000, "centralBankLiquiditySwaps": 100, "msFacilitiesNetPortfolio": 800, "otherAssetItems": 64600 }
    },
    {
      "date": "2026-08-12", "totalAssets": 6642400, "treasurySecurities": 4524200,
      "mortgageBackedSecurities": 1936100, "reserveBalances": 3182000,
      "onRrp": 42000, "treasuryGeneralAccount": 745000, "netLiquidity": 5855400,
      "reverseRepoTotal": 332000, "assetMixOther": 182100,
      "assetComponents": { "agencyDebt": 2000, "unamortizedPremiums": 100400, "unamortizedDiscounts": -25100, "assetRepurchaseAgreements": 500, "loans": 7000, "centralBankLiquiditySwaps": 100, "msFacilitiesNetPortfolio": 800, "otherAssetItems": 96400 }
    },
    {
      "date": "2026-08-19",
      "totalAssets": 6630000,
      "treasurySecurities": 4520000,
      "mortgageBackedSecurities": 1930000,
      "reserveBalances": 3200000,
      "onRrp": 20000,
      "treasuryGeneralAccount": 780000,
      "netLiquidity": 5830000,
      "reverseRepoTotal": 310000,
      "assetMixOther": 180000,
      "assetComponents": { "agencyDebt": 2000, "unamortizedPremiums": 100000, "unamortizedDiscounts": -25000, "assetRepurchaseAgreements": 1000, "loans": 8000, "centralBankLiquiditySwaps": 100, "msFacilitiesNetPortfolio": 800, "otherAssetItems": 93100 }
    }
  ],
  "treasuryBreakdown": {
    "bills": 520000,
    "nominalNotesBonds": 3610000,
    "tipsPrincipal": 280000,
    "inflationCompensation": 110000
  },
  "changeBridge": {
    "period": "1w",
    "startDate": "2026-08-12",
    "endDate": "2026-08-19",
    "netLiquidityChange": -25400,
    "contributions": { "totalAssets": -12400, "tga": -35000, "onRrp": 22000 },
    "assetDrivers": { "treasurySecurities": -4200, "mortgageBackedSecurities": -6100, "agencyDebt": 0, "unamortizedPremiums": -400, "unamortizedDiscounts": 100, "assetRepurchaseAgreements": 500, "loans": 1000, "centralBankLiquiditySwaps": 0, "otherAssetItems": -3300 }
  },
  "liquidityPulse": {
    "state": "draining",
    "summary": "The net liquidity proxy fell as the TGA increase and asset decline outweighed lower ON RRP."
  },
  "stressWatch": {
    "state": "normal",
    "items": [
      { "key": "primaryCredit", "value": 5200, "wow": -400, "percentile52w": 41, "state": "normal" },
      { "key": "otherCreditExtensions", "value": 0, "wow": 0, "percentile52w": 0, "state": "normal" },
      { "key": "centralBankLiquiditySwaps", "value": 135, "wow": 0, "percentile52w": 18, "state": "normal" }
    ]
  }
}
```

위 숫자는 UI 개발용 예시일 뿐 실제 H.4.1 값으로 간주하거나 배포하지 않는다. mock 화면에도 `Mock data` badge를 표시한다.

## 9. API 및 ingestion 설계

### 내부 API

`GET /api/h41?range=2y`

- `range`: `6m | 1y | 2y | 5y | max`, 기본 `2y`.
- `changePeriod`: `1w | 4w | 13w | 52w | selected`, 기본 `1w`. `selected`일 때에는 차트에서 지정한 `startDate`와 `endDate`를 같은 수요일 관측일로 전달한다.
- 응답의 `changeBridge`는 요청한 한 기간의 결과이며, 시작·종료일과 `netLiquidityChange = totalAssets − TGA − ON RRP 기여도 합계`를 함께 반환한다. 자산 내부 `assetDrivers`의 합계도 `totalAssets` 기여도와 일치해야 한다.
- 성공 시 위 mock 계약과 동일한 형식으로 반환한다.
- `ETag` 또는 `Last-Modified`를 지원하고 주간 데이터 특성에 맞게 캐시한다.
- 데이터가 오래됐지만 마지막 정상값이 있으면 HTTP 200과 `meta.status = "stale"`을 반환한다.
- 사용 가능한 데이터가 전혀 없으면 HTTP 503과 사용자 친화적 오류 코드를 반환한다.

### ingestion pipeline

```text
FederalReserve.gov H.4.1 CSV/SDMX + New York Fed ON RRP daily result
  → 출처별 raw snapshot 저장
  → schema/series mapping 및 거래 유형 검증
  → H.4.1 Wednesday level·ON RRP 같은 날 잔액 정규화
  → 관측일·단위 기준 series join
  → WoW/YoY 및 파생값 계산
  → normalized snapshot 원자적 교체
  → dashboard API
```

### 갱신 주기

- H.4.1 발표 주기에 맞춘 **weekly refresh**. ON RRP 일별 거래 결과는 해당 수요일 관측값을 선택해 결합한다.
- 권장 실행 시점: 목요일 공식 발표 이후. 시간은 배포 환경에서 설정값으로 관리하고 release calendar에 의존한다.
- 실패 시 지수 백오프로 재시도하되 원천 서버를 과도하게 호출하지 않는다.
- 새 snapshot이 검증을 통과하기 전까지 기존 정상 snapshot을 유지한다.
- 최신 관측일이 예상보다 8일 이상 오래되면 `stale` 경고를 표시한다.

### 정규화 검증

- 날짜, 단위, observation basis가 명시돼야 한다.
- `onRrp`가 수요일 익일물 거래의 accepted amount인지 확인하고, 십억 달러에서 백만 달러로 변환했는지 검증한다. 해당 수요일에 결과가 없으면 임의의 인접 영업일이나 H.4.1 전체 역레포로 대체하지 않는다.
- 같은 날짜와 같은 내부 키의 중복을 거부한다.
- 금액은 유한한 수 또는 `null`이어야 한다.
- Treasury drill-down 합계와 Treasury Securities 차이를 기록한다. inflation compensation 등 정의 차이를 고려해 무조건 실패시키지 않는다.
- 모든 기간에 `netLiquidity = totalAssets - treasuryGeneralAccount - onRrp`, `ΔnetLiquidity = ΔtotalAssets - ΔTGA - ΔonRrp` 및 자산 내부 기여도 합계를 대사한다. 시작·종료 관측일이 다르면 계산을 거부한다. `reverseRepoTotal`과 `onRrp`의 범위 차이를 기록한다.
- H.4.1 Table 5의 `totalAssets = totalLiabilities + totalCapital` 및 주요 자산 항목 합계를 대사하되, 공표된 백만 달러 단위의 반올림 차이는 허용한다.
- 최신값이 전주 대비 비정상적으로 크게 변하면 제거하지 말고 quarantine 경고와 함께 원자료 확인 대상으로 표시한다.
- series가 누락되거나 label이 바뀌면 0으로 대체하지 않고 ingestion을 실패시켜 stale snapshot을 제공한다.

## 10. Loading, error, empty 및 stale 상태

- **Loading:** Net Liquidity 주 차트와 1주·4주·13주 변화량, 기여도 브리지, 원인 패널, 교차 확인 영역의 구조를 유지하는 skeleton. 화면 전체 spinner는 사용하지 않는다.
- **Partial:** 일부 보조 지표가 없으면 핵심 KPI는 보여주고 해당 모듈에 `Data unavailable`을 표시한다.
- **Error:** 마지막 정상 snapshot이 있으면 stale banner와 함께 계속 제공한다.
- **Empty:** 선택 기간에 관측치가 없음을 명확히 표시하고 범위 초기화 버튼을 제공한다.
- **Stale:** `Last updated`, `Observation date`, `Expected weekly update`를 표시한다.
- **Mock:** 실제 데이터로 오인되지 않도록 모든 개발 mock에 고정 badge를 둔다.

## 11. 반응형 및 접근성

- `≥1280px`: Net Liquidity 차트와 변화량·기여도는 전체 너비, 그 아래 총자산·TGA·ON RRP 원인 패널은 2열 구성. TGA와 ON RRP 추이 차트는 같은 패널 안에서 나란히 표시한다.
- `768–1279px`: 순유동성 주 차트를 유지하고 원인 패널은 1열 또는 비율 축소한다. TGA와 ON RRP 차트는 공간에 따라 세로로 쌓는다.
- `<768px`: Net Liquidity 현재값·기간 변화와 기여도를 먼저 표시하고, 원인 차트·보조 표는 세로로 재배치한다. 차트 툴팁은 터치에 대응한다.
- 키보드로 기간 선택, 카드, drill-down을 조작할 수 있어야 한다.
- 상태를 색상 하나로만 전달하지 않는다.
- 그래프에는 접근 가능한 제목·요약을 제공하고 `prefers-reduced-motion`을 존중한다.

## 12. 첫 번째 구현 단계

### Phase 1 — UI vertical slice

Codex는 다음 순서로 첫 실행 가능한 화면을 만든다.

1. 현재 저장소에 Next.js + TypeScript + Tailwind 기반 앱을 초기화한다. 기존 파일과 `sources/`는 변경하지 않는다.
2. `src/types/h41.ts`에 JSON 계약 타입과 Zod schema를 정의한다.
3. `public/mock/h41-dashboard.json`에 최소 104주 분량의 명확한 mock 시계열을 만든다. 값은 결정적 생성 규칙을 사용하고 `Mock data`로 표시한다.
4. `/api/h41`은 먼저 mock을 반환하도록 구현하되, UI가 데이터 접근 계층을 통해서만 호출하게 한다.
5. header와 Net Liquidity 현재값·1주·4주·13주 변화량 및 독립된 전체 너비 추이 차트를 구현한다.
6. 선택 기간의 `Δ총자산 − ΔTGA − ΔON RRP` 기여도 브리지를 구현하고, 기간·날짜와 합계가 일치하도록 검증한다.
7. 총자산 추이·자산 내부 기여도, TGA·ON RRP 추이, 지급준비금 교차 확인을 구현한다.
8. Asset Mix, Balance Sheet Summary, Treasury drill-down, Stress Watch를 보조 패널로 구현한다.
9. loading/error/stale/empty 상태를 구현한다.
10. 1440×900, 1024×768, 390×844 viewport에서 시각 검증한다.
11. 파생 계산 단위 테스트와 Playwright smoke test를 실행한다.

### Phase 2 — 실제 H.4.1 ingestion

1. H.4.1 Table 1·Table 5와 뉴욕 연은 ON RRP 일별 결과의 샘플 원본을 fixture로 저장한다.
2. 원천 series ID와 내부 key를 `series-map.ts`에 명시한다.
3. H.4.1 CSV adapter, ON RRP 거래 결과 adapter와 정규화 로직을 구현한다.
4. 동일 날짜 기준 join, 1주·4주·13주·52주 변화, Net Liquidity 및 자산 내부 기여도, Asset Mix, stress percentile을 구현한다.
5. SDMX/XML adapter를 추가하고 CSV 결과와 주요 계열을 대사한다.
6. weekly scheduler가 호출할 `scripts/ingest-h41.ts`와 운영 저장소 adapter를 연결한다.
7. FRED fallback은 기능 flag 뒤에 두고, 활성화 시 약관 고지를 별도 검토한다.

### Phase 1 완료 기준

- Net Liquidity 주 차트와 현재값·1주·4주·13주 변화량이 최상단에 렌더링되고, 전체 이력(Max)까지 선택할 수 있다.
- 같은 기간 `Δ총자산 − ΔTGA − ΔON RRP = ΔNet Liquidity` 및 총자산 내부 항목의 합계가 계산·표시된다. 기간 선택을 바꾸면 모든 기여도와 날짜가 함께 바뀐다.
- 총자산, TGA, ON RRP 원인 추이와 지급준비금 교차 확인이 주 차트 아래에 표시된다. TGA/ON RRP는 각자의 축을 사용하고 날짜 범위를 공유한다.
- Treasury drill-down과 Stress Watch를 키보드로 사용할 수 있다.
- loading/error/stale/empty/mock 상태가 각각 재현 가능하다.
- 1440px에서 핵심 정보가 첫 화면에 들어오고, 390px에서도 가로 페이지 overflow가 없다.
- `npm test`, lint, type check 및 Playwright smoke test가 통과한다.

## 13. 구현 시 결정 원칙

- 화면 컴포넌트가 H.4.1 label, CSV 열 번호 또는 FRED series ID를 직접 참조하지 않는다.
- raw 값, normalized 값, display format을 분리한다.
- 데이터 오류를 예쁜 차트로 숨기지 않는다. 관측일·출처·상태를 항상 노출한다.
- 주간 데이터이므로 실시간 시세처럼 보이게 하는 애니메이션이나 live badge를 사용하지 않는다.
- 파생 지표와 해석 문구에는 `Product-defined` 또는 동일 의미의 설명을 제공한다.
- 원천 수정(revision)에 대비해 같은 관측일의 snapshot 교체 이력과 fetched timestamp를 남긴다.

## 14. 범위 제외(MVP)

- 사용자 로그인, 권한, 과금
- 실시간 시장가격과의 결합
- 매매 신호 또는 투자 추천
- 알림 전송
- 다국어 전체 지원
- FRED 로고·연준 로고 등 상표 자산 사용
- 정교한 이벤트 주석과 경기국면 모델

이 항목들은 데이터 ingestion과 핵심 대시보드가 안정화된 뒤 별도 단계로 다룬다.

## 15. 로컬 변경 자동 푸시

이 작업 환경에서는 `FED_BalanceSheet_AutoPush` Windows 작업이 로그인 시 [`scripts/auto-push.ps1`](scripts/auto-push.ps1)을 실행한다. 파일 변경이 10초 동안 멈추면 변경 파일을 커밋하고 `origin/main`에 푸시한다. 연결 오류가 나면 60초 뒤 다시 시도하며, 실행 기록은 Git에서 제외한 `auto-push.log`에 남긴다. 원격 브랜치에 새 커밋이 있으면 자동 병합이나 강제 푸시를 하지 않고 로그에 오류를 기록한다.

작업이 실행 중인 경우에만 변경 직후 동기화되며, Windows에서 로그아웃한 동안의 변경은 다음 로그인 후 처리한다. 일회성 수동 실행: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/auto-push.ps1 -Once`.
