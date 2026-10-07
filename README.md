# Federal Reserve H.4.1 Web Terminal

미 연준 대차대조표(H.4.1)를 트레이더와 금융정보 단말 사용자가 빠르게 해석할 수 있도록 제공하는 현대적인 웹형 대시보드의 개발 브리프다. 이 문서는 제품 범위, 데이터 계약, 화면 구조와 첫 구현 순서를 정의하며, Codex가 별도의 기획 보완 없이 MVP 개발을 시작할 수 있는 수준을 목표로 한다.

## 1. 프로젝트 목표

- Federal Reserve H.4.1 데이터를 수집·정규화해 주간 시계열로 제공한다.
- 핵심 자산·부채와 유동성 지표를 한 화면에서 빠르게 비교할 수 있게 한다.
- 단순 원자료 나열이 아니라 WoW/YoY 변화, 자산 구성, 유동성, 정책 및 스트레스 신호를 함께 보여준다.
- Bloomberg/Reuters 계열 단말의 정보 밀도는 유지하되, 현대적인 웹 UI의 색상·간격·상호작용을 적용한다.
- 초기 버전은 데스크톱 단말을 우선하고 태블릿과 모바일에서는 읽기 가능한 형태로 재배치한다.

### 주요 사용자

- 채권·금리·FX·주식 트레이더
- 거시경제 및 유동성 전략가
- 세일즈, 리서치, 운용 및 리스크 담당자

### 사용자가 10초 안에 답할 수 있어야 하는 질문

1. 연준 대차대조표는 이번 주 확대됐는가, 축소됐는가?
2. 국채와 MBS 보유액은 어떤 방향으로 움직이는가?
3. 지급준비금, TGA, RRP를 반영한 시장 순유동성은 증가했는가?
4. 변화가 평상시 수준인가, 스트레스성 유동성 공급 신호인가?
5. 국채 보유 구성에서 Bills, Nominal Notes & Bonds, TIPS 중 무엇이 변했는가?

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

### 라이선스 메모

- Federal Reserve Board는 별도 표시가 없는 웹사이트 정보를 public domain으로 안내하며 허가 없이 복제·배포할 수 있다고 밝히고 있다. 출처 표시는 권장한다.
- 따라서 H.4.1 원천 수치는 상업 금융정보 서비스에서 재배포 가능한 것으로 설계하되, 로고·제3자 이미지·그래픽은 원천 수치와 구분한다.
- 이 README는 법률 자문이 아니다. 상용 출시 전 최신 정책과 제품 내 고지 문구를 사내 법무가 재확인한다.
- 공식 근거: [Federal Reserve Board disclaimer](https://www.federalreserve.gov/disclaimer.htm), [H.4.1 Data Download Program](https://www.federalreserve.gov/datadownload/Choose.aspx?rel=h41), [FRED API Terms of Use](https://fred.stlouisfed.org/docs/api/terms_of_use.html)

### 수집 형식 전략

- **MVP:** Table 1 및 Table 5 CSV를 사용해 빠르게 구현한다.
- **Production:** 전체 SDMX/XML 파서를 별도 어댑터로 구현한다. 원천의 설명 문구나 열 순서가 바뀌어도 series key를 기준으로 매핑해야 한다.
- HTML 표 스크래핑은 CSV/XML 장애 시 진단용에만 사용하고 운영 데이터 소스로 삼지 않는다.
- 원본 응답은 변경하지 않고 날짜별 raw snapshot으로 보존하며, 정규화 결과와 분리한다.

> 주의: Board는 Data Download Program의 일부 기능 제거 및 향후 변경을 예고했다. 다운로드 URL이나 CSV 열 위치를 UI 코드에 직접 고정하지 말고 `ingestion adapter → normalizer → dashboard API` 계층으로 분리한다.

## 3. 관측 기준과 데이터 필드 분석

H.4.1 표에는 주간 평균과 수요일 잔액이 함께 존재할 수 있다. KPI와 차트는 비교 가능성을 위해 **수요일 기준 잔액(Wednesday level), 단위 USD millions**로 통일한다. 화면에서는 기본적으로 조 달러(`$T`) 또는 십억 달러(`$B`)로 표시하되 계산과 저장은 원 단위인 million USD를 유지한다.

### 필수 KPI 6개

| 내부 키 | 화면명 | H.4.1 원천 항목 | 권장 표 | 의미 |
|---|---|---|---|---|
| `totalAssets` | Total Assets | Total assets | Table 5 | 연준 연결 대차대조표 총자산 |
| `treasurySecurities` | Treasury Securities | U.S. Treasury securities | Table 1 | 연준 보유 미 국채 |
| `mortgageBackedSecurities` | MBS | Mortgage-backed securities | Table 1 | 연준 보유 기관 MBS |
| `reserveBalances` | Reserve Balances | Reserve balances with Federal Reserve Banks | Table 1 | 예금취급기관의 연준 지급준비금 |
| `reverseRepo` | Reverse Repo | Reverse repurchase agreements | Table 1 | 국내·해외 공식계정을 포함한 H.4.1 역레포 합계 |
| `treasuryGeneralAccount` | TGA | U.S. Treasury — General Account | Table 1 | 미 재무부 연준예치금 |

`reverseRepo`는 H.4.1의 주간 수요일 잔액을 뜻한다. 뉴욕 연은의 일별 ON RRP 사용액과 혼용하지 않는다. 다른 정의를 추가할 경우 `onRrpDaily`처럼 별도 키와 출처를 사용한다.

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
| `currencyInCirculation` | Currency in circulation | 부채 구성 및 준비금 설명 |

원천 항목이 중단·명칭 변경될 수 있으므로 `series-map.ts`에서 `active`, `validFrom`, `validTo`, `aliases`를 관리한다. 값이 없는 경우 `0`으로 바꾸지 말고 `null`로 저장한다.

## 4. 파생 지표와 계산 규칙

### 변화값

각 KPI와 파생 지표에 다음을 계산한다.

```text
WoW absolute = current - previous available weekly observation
WoW percent  = (current / previous - 1) × 100
YoY absolute = current - observation nearest to current date - 52 weeks
YoY percent  = (current / yearAgo - 1) × 100
```

- 결측 주가 있으면 단순 배열 인덱스가 아니라 목표일과 가장 가까운 이전 관측치를 선택한다.
- YoY 허용 오차는 목표일 기준 ±7일이다. 범위 내 값이 없으면 `null`과 `N/A`를 반환한다.
- 값의 상승이 항상 긍정적인 것은 아니므로 카드 색은 단순 양/음이 아니라 지표 의미를 반영한다. 기본 카드 변화값은 중립 색, 해석 신호에만 semantic color를 사용한다.

### Net Liquidity

```text
Net Liquidity = Total Assets - TGA - Reverse Repo
```

- 세 입력 모두 동일한 H.4.1 수요일 관측일과 동일 단위여야 한다.
- 이 값은 시장 유동성을 설명하기 위한 **제품 정의의 proxy**이며 공식 연준 지표가 아니다.
- 툴팁: `Product-defined proxy: Federal Reserve total assets less the Treasury General Account and reverse repos.`
- 입력 중 하나라도 없으면 해당 날짜의 결과는 `null`로 처리한다.

### Asset Mix

```text
Treasuries share = Treasury Securities / Total Assets
MBS share        = MBS / Total Assets
Other share      = max(Total Assets - Treasuries - MBS, 0) / Total Assets
```

- stacked area는 금액 기준을 기본으로 하고, 툴팁에서 비중도 함께 제공한다.
- 대사 차이와 회계 조정이 존재하므로 Other를 단순 오류로 취급하지 않는다.

### Liquidity / Policy Pulse

초기 버전은 모델 예측이 아닌 규칙 기반 설명을 제공한다.

- `Net Liquidity WoW > 0`: Liquidity adding
- `Net Liquidity WoW < 0`: Liquidity draining
- `Total Assets WoW > 0`: Balance sheet expanding
- `Total Assets WoW < 0`: Balance sheet contracting
- TGA와 RRP의 WoW 기여도를 각각 `-ΔTGA`, `-ΔRRP`로 표시한다.
- 가장 큰 절대 기여 항목을 한 줄 요약에 사용한다.

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
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Assets   │ Treasury │ MBS      │ Reserves │ RRP      │ TGA         │
│ WoW/YoY  │ WoW/YoY  │ WoW/YoY  │ WoW/YoY  │ WoW/YoY  │ WoW/YoY     │
├────────────────────────────────┬───────────────────────────────────┤
│ Total Assets · 2Y line chart   │ Asset Mix · stacked area          │
├────────────────────────────────┼───────────────────────────────────┤
│ Balance Sheet Summary          │ Liquidity / Policy Pulse          │
│ + Treasury drill-down          │ Net Liquidity + Stress Watch      │
└────────────────────────────────┴───────────────────────────────────┘
```

### 상단: 6 KPI 카드

- 순서: Total Assets, Treasury Securities, MBS, Reserve Balances, Reverse Repo, TGA.
- 각 카드: 현재값, 단위, WoW 절대/퍼센트, YoY 절대/퍼센트, 작은 방향 표시.
- `as of YYYY-MM-DD`는 헤더에서 공통 표시하고 카드별 관측일이 다를 때만 카드에 경고한다.
- 숫자는 tabular-nums를 적용하고, 큰 값은 `$7.12T`, 변화값은 `−$24.6B`처럼 표시한다.

### 중앙 왼쪽: Total Assets 2년 line chart

- 기본 범위 2Y, 선택 범위 6M / 1Y / 2Y / 5Y / Max.
- Total Assets 실선, 선택적으로 Net Liquidity 점선을 오버레이한다.
- 수직 grid는 최소화하고 hover crosshair와 날짜·현재값·WoW tooltip을 제공한다.
- 최신 값 라벨과 2년 고점/저점은 겹치지 않을 때만 표시한다.

### 중앙 오른쪽: Asset Mix stacked area

- Treasuries, MBS, Other를 겹침 없는 stacked area로 표시한다.
- 고정된 색상 매핑을 사용한다: Treasuries=cyan, MBS=violet, Other=slate.
- 툴팁에는 금액과 Total Assets 대비 비중을 함께 표시한다.

### 하단 왼쪽: Balance Sheet Summary

- Assets / Liabilities 두 열의 compact table.
- 핵심 행만 기본 노출하고 `View full table`로 확장한다.
- Treasury 행 클릭 시 Bills / Nominal Notes & Bonds / TIPS drill-down을 펼친다.
- 합계 대사 차이가 허용오차를 넘으면 작은 경고 아이콘과 차액을 표시한다.

### 하단 오른쪽: Liquidity Metrics

- Net Liquidity 현재값, WoW, YoY.
- WoW contribution bar: `ΔTotal Assets`, `−ΔTGA`, `−ΔRRP`.
- Liquidity / Policy Pulse 요약 문장 1개.
- Stress Watch: Primary Credit, Other Credit Extensions, Central Bank Liquidity Swaps와 상태 badge.

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
│  │  ├─ total-assets-chart.tsx
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

금액 필드는 모두 `USD millions`, 날짜는 ISO `YYYY-MM-DD`다. 프런트엔드는 원천 필드명을 직접 알지 않고 이 계약만 사용한다.

```json
{
  "meta": {
    "source": "Federal Reserve Board H.4.1",
    "sourceUrl": "https://www.federalreserve.gov/releases/h41/current/",
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
    "reverseRepo": { "value": 310000, "wow": -22000, "wowPct": -6.63, "yoy": -190000, "yoyPct": -38.0 },
    "treasuryGeneralAccount": { "value": 780000, "wow": 35000, "wowPct": 4.7, "yoy": 60000, "yoyPct": 8.33 },
    "netLiquidity": { "value": 5540000, "wow": -25400, "wowPct": -0.46, "yoy": -50000, "yoyPct": -0.89 }
  },
  "history": [
    {
      "date": "2026-08-19",
      "totalAssets": 6630000,
      "treasurySecurities": 4520000,
      "mortgageBackedSecurities": 1930000,
      "reserveBalances": 3200000,
      "reverseRepo": 310000,
      "treasuryGeneralAccount": 780000,
      "netLiquidity": 5540000,
      "otherAssets": 180000
    }
  ],
  "treasuryBreakdown": {
    "bills": 520000,
    "nominalNotesBonds": 3610000,
    "tipsPrincipal": 280000,
    "inflationCompensation": 110000
  },
  "liquidityPulse": {
    "state": "draining",
    "summary": "Net liquidity declined as the TGA increase outweighed lower reverse repos.",
    "contributions": {
      "totalAssets": -12400,
      "tga": -35000,
      "reverseRepo": 22000
    }
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
- 성공 시 위 mock 계약과 동일한 형식으로 반환한다.
- `ETag` 또는 `Last-Modified`를 지원하고 주간 데이터 특성에 맞게 캐시한다.
- 데이터가 오래됐지만 마지막 정상값이 있으면 HTTP 200과 `meta.status = "stale"`을 반환한다.
- 사용 가능한 데이터가 전혀 없으면 HTTP 503과 사용자 친화적 오류 코드를 반환한다.

### ingestion pipeline

```text
FederalReserve.gov CSV/SDMX
  → raw snapshot 저장
  → schema/series mapping 검증
  → Wednesday level 정규화
  → 날짜별 series join
  → WoW/YoY 및 파생값 계산
  → normalized snapshot 원자적 교체
  → dashboard API
```

### 갱신 주기

- H.4.1 발표 주기에 맞춘 **weekly refresh**.
- 권장 실행 시점: 목요일 공식 발표 이후. 시간은 배포 환경에서 설정값으로 관리하고 release calendar에 의존한다.
- 실패 시 지수 백오프로 재시도하되 원천 서버를 과도하게 호출하지 않는다.
- 새 snapshot이 검증을 통과하기 전까지 기존 정상 snapshot을 유지한다.
- 최신 관측일이 예상보다 8일 이상 오래되면 `stale` 경고를 표시한다.

### 정규화 검증

- 날짜, 단위, observation basis가 명시돼야 한다.
- 같은 날짜와 같은 내부 키의 중복을 거부한다.
- 금액은 유한한 수 또는 `null`이어야 한다.
- Treasury drill-down 합계와 Treasury Securities 차이를 기록한다. inflation compensation 등 정의 차이를 고려해 무조건 실패시키지 않는다.
- 최신값이 전주 대비 비정상적으로 크게 변하면 제거하지 말고 quarantine 경고와 함께 원자료 확인 대상으로 표시한다.
- series가 누락되거나 label이 바뀌면 0으로 대체하지 않고 ingestion을 실패시켜 stale snapshot을 제공한다.

## 10. Loading, error, empty 및 stale 상태

- **Loading:** KPI 6개, 차트 2개, 하단 패널 구조를 유지하는 skeleton. 화면 전체 spinner는 사용하지 않는다.
- **Partial:** 일부 보조 지표가 없으면 핵심 KPI는 보여주고 해당 모듈에 `Data unavailable`을 표시한다.
- **Error:** 마지막 정상 snapshot이 있으면 stale banner와 함께 계속 제공한다.
- **Empty:** 선택 기간에 관측치가 없음을 명확히 표시하고 범위 초기화 버튼을 제공한다.
- **Stale:** `Last updated`, `Observation date`, `Expected weekly update`를 표시한다.
- **Mock:** 실제 데이터로 오인되지 않도록 모든 개발 mock에 고정 badge를 둔다.

## 11. 반응형 및 접근성

- `≥1280px`: KPI 6열, 중앙/하단 2열.
- `768–1279px`: KPI 3×2, 차트와 하단 패널은 1열 또는 비율 축소.
- `<768px`: KPI 가로 스크롤 또는 2열, 표는 핵심 열만 유지, 차트 툴팁은 터치 대응.
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
5. header와 6 KPI 카드를 구현한다.
6. Recharts로 2년 Total Assets line chart와 Asset Mix stacked area를 구현한다.
7. Balance Sheet Summary, Treasury drill-down, Net Liquidity contribution, Stress Watch를 구현한다.
8. loading/error/stale/empty 상태를 구현한다.
9. 1440×900, 1024×768, 390×844 viewport에서 시각 검증한다.
10. 파생 계산 단위 테스트와 Playwright smoke test를 실행한다.

### Phase 2 — 실제 H.4.1 ingestion

1. Table 1/Table 5의 샘플 원본을 fixture로 저장한다.
2. 원천 series ID와 내부 key를 `series-map.ts`에 명시한다.
3. CSV adapter와 정규화 로직을 구현한다.
4. 동일 날짜 기준 join, WoW/YoY, Net Liquidity, Asset Mix, stress percentile을 구현한다.
5. SDMX/XML adapter를 추가하고 CSV 결과와 주요 계열을 대사한다.
6. weekly scheduler가 호출할 `scripts/ingest-h41.ts`와 운영 저장소 adapter를 연결한다.
7. FRED fallback은 기능 flag 뒤에 두고, 활성화 시 약관 고지를 별도 검토한다.

### Phase 1 완료 기준

- 6개 KPI와 WoW/YoY가 동일 mock 계약에서 렌더링된다.
- Total Assets 2Y line chart와 Asset Mix stacked area가 tooltip·범례와 함께 동작한다.
- Net Liquidity가 UI에 명시된 식으로 계산·표시된다.
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
