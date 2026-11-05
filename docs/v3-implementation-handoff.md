# FedBalanceSheet v3 구현 연결 명세

이 문서는 [운영 작업 명세](fed-balance-sheet-v3-operations.md)를 현재 코드에 연결하기 위한 개발팀용 안내다. 최종 화면은 [FedBalanceSheet_v3.html](../FedBalanceSheet_v3.html)이다.

회사 예약 작업은 **매일 07:15 KST**에 실행한다. **매 실행마다 아래 표의 시작일부터 최신 공개일까지 전체 이력을 다시 수집**해 JSON 한 벌을 만든다. 날짜를 지정하는 원천은 여러 요청으로 나눌 수 있으나 최근 며칠치만 받는 증분 수집으로 바꾸지 않는다. 화면 데이터가 달라졌을 때만 새 JSON 버전을 Altibase에 적재한다.

## 1. 현재 구현과 회사에서 추가할 부분

| 단계 | 현재 구현 | 회사 운영에 필요한 작업 |
|---|---|---|
| 원천 수집 | [scripts/ingest.py](../scripts/ingest.py)가 H.4.1, ON RRP, SOFR, EFFR, IORB, 익일물 레포의 전체 사용 이력을 다운로드 | 매일 07:15 KST 실행하도록 예약하고, 매번 전체 사용 이력을 다시 조회 |
| 정리·검증 | 같은 코드가 수요일 결합, 단위 변환, 결측 처리, 대사 검증 수행 | 회사 실행 환경과 실패 알림 연결 |
| 화면용 JSON 생성 | 같은 코드가 `meta`, `history`, `quality`, `provenance`, `fundingDaily` 한 벌을 [latest.json](../data/normalized/latest.json)에 저장 | 변경 판단과 Altibase 조각 저장 추가 |
| 화면 응답 | [scripts/serve.py](../scripts/serve.py)는 로컬 JSON 파일을 읽어 `/api/h41`에 응답 | 회사 서버가 Altibase의 현재 버전 조각을 합쳐 같은 응답 제공 |
| 화면 새로고침 | [assets/data.js](../assets/data.js)는 버튼에서 `POST /api/refresh`로 즉시 원천을 재수집 | 버튼은 저장된 최신 버전 재조회로 변경 |

기존 `scripts/serve.py`는 로컬 개발용이다. Altibase 연결과 운영 서버 기능은 구현되어 있지 않다.

## 2. 원천별 수집 설정

정확한 URL과 필터는 [scripts/ingest.py](../scripts/ingest.py)의 상수를 기준으로 한다. 아래 범위는 **최초 적재와 매일 재수집에 똑같이 적용**한다. 원천의 발표 주기는 [발표 주기 문서](DATA_UPDATE_SCHEDULE.md)를 참고한다.

| 데이터 | 원천 주소 | 현재 요청 범위 |
|---|---|---|
| H.4.1 | `https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip` | 전체 XML |
| ON RRP | `https://markets.newyorkfed.org/api/rp/results/search.json` | 2013-09-23부터 연도별 날짜 지정, Reverse Repo·Overnight |
| SOFR | `https://markets.newyorkfed.org/api/rates/secured/sofr/search.json` | 2021-07-28부터 |
| EFFR | `https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json` | 2021-07-28부터 |
| IORB | `https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip` | 전체 ZIP의 `RESBM_N.D` 계열. 실제 첫 적용일 2021-07-29 |
| 익일물 레포 | ON RRP와 같은 거래 결과 API | 2021-07-28부터 연도별 날짜 지정, Repo·Overnight. 시험성 소액 거래 제외 |

H.4.1은 원천의 수요일 잔액을 사용한다. ON RRP도 같은 수요일 거래만 주간 자료에 결합한다. 금리와 레포는 일간 자료로 보존하고, 주간 행에는 같은 수요일 값만 넣는다. 금액은 `USD millions`, 금리와 금리 차이는 각각 퍼센트와 bp 단위다. 없는 값은 `null`로 둔다.

## 3. 화면용 JSON 계약

[scripts/ingest.py](../scripts/ingest.py)의 `run()` 결과와 현재 [latest.json](../data/normalized/latest.json)이 실제 응답 형식이다. 회사 서버는 JSON 본문을 변형하지 않고 `GET /api/h41`에서 `Content-Type: application/json; charset=utf-8`로 전달한다. 조회할 때 `snapshot_id = FED_BALANCE_SHEET_V3`의 현재 `version_id`를 한 번 읽고, 해당 버전의 조각만 순번대로 합친다.

| 최상위 항목 | 내용 |
|---|---|
| `meta` | 자료 상태, 주간·일간 기준일, 발표일, 수집 시각, 단위, 원천 정보 |
| `history` | 2013-09-25부터 수요일별 H.4.1, ON RRP, 금리, 레포, 파생 지표 |
| `fundingDaily` | 2021-07-28부터 일별 SOFR, EFFR, IORB, 레포 이용액과 금리 차이 |
| `quality` | 결측, 중복, 대사 결과와 제외된 거래 수 |
| `provenance` | 원천 주소, 계열 대응, 계산 및 결합 기준 |

필수 화면 검사는 [assets/data.js](../assets/data.js)의 `validateSnapshot()`에 있다. `meta.status = "actual"`, `meta.unit = "USD millions"`, `meta.observationBasis = "wednesday_level"`이 필요하다. `history`는 날짜가 오름차순인 수요일 행이어야 하며 마지막 행의 날짜와 `meta.observationDate`가 같아야 한다. 최신 행의 순유동성 계산 입력이 모두 있어야 한다. 회사 서버가 임의로 필드를 빼거나 빈 값을 0으로 바꾸면 화면 검사가 실패하거나 수치가 달라질 수 있다.

현재 `latest.json`에는 매번 변하는 `meta.fetchedAt`, `meta.rawManifest`, 원천 manifest 경로 등이 들어 있다. 변경 여부는 화면에서 의미 있는 숫자와 기준일을 비교하되, 새 버전을 만들기로 했다면 화면에 전달할 **완성된 JSON 원본 바이트**를 조각으로 저장한다. 화면용 JSON에 넣을 `fetchedAt`의 정의와 변경 판단 대상은 수집 프로그램에서 일관되게 처리한다.

## 4. 수집 프로그램과 Altibase의 연결

1. `run()`이 원천 다운로드, 정리, 원천 검증을 완료한다. 현재 코드는 로컬 `latest.json`과 `actual-data.js`도 갱신한다.
2. 수집 프로그램이 현재 제공 중인 화면 데이터와 비교한다. 화면 데이터가 같으면 DB 버전은 바꾸지 않는다.
3. 달라졌으면 완성 JSON을 회사 문자셋에서 각 칼럼의 저장 크기가 4,000바이트 이하가 되도록 문자 경계에서 나눈다. 칼럼과 키는 [운영 명세의 표](fed-balance-sheet-v3-operations.md#4-altibase-테이블과-칼럼)를 따른다.
4. 수집 프로그램이 새 버전의 모든 조각을 저장하고 다시 읽어 개수, 바이트 길이, SHA-256, JSON 형식을 원본과 대조한다. DB는 값만 저장·조회한다.
5. 검증 후 현재 제공 버전을 한 번에 변경한다. 이전 버전으로 이미 시작한 화면 요청이 끝날 시간을 둔 뒤 수집 프로그램이 이전 버전 행을 삭제한다.

원천 자료, 적재 상태, 실패 이력에 관한 로그는 수집 프로그램에서 남긴다. 수집 실패 시 현재 제공 버전을 바꾸지 않는다.

## 5. v3 화면 배포와 새로고침

v3 HTML은 `assets/theme-tokens.css`, `assets/dashboard.css`, `assets/vendor/vue-3.2.41.global.prod.js`, `assets/i18n.js`, `assets/actual-data.js`, `assets/data.js`, `assets/app.js`, `assets/fonts/`를 사용한다. 회사 서버에서 이 정적 파일과 `/api/h41`을 같은 사이트 주소로 제공한다.

현재 화면은 시작할 때 `assets/actual-data.js`의 번들 데이터를 읽고, 서버 모드에서 `/api/h41`을 다시 요청한다. 회사 운영 시에는 이 번들 때문에 이전 자료가 잠깐 표시되지 않도록 시작 경로를 DB 응답 기준으로 조정해야 한다. 화면의 새로고침 버튼은 현재 `POST /api/refresh`로 수집까지 실행한다. 회사에서는 예약 수집과 분리하고 `GET /api/h41`을 다시 호출하도록 바꾼다. 파일을 더블클릭하는 `file://` 모드와 회사 서버 모드의 동작도 이때 확인한다.

## 6. 확인 절차

- 수집 코드는 Python 표준 라이브러리를 사용한다. `python scripts/ingest.py`로 수집할 수 있으나 실제 원천에 접속하고 로컬 결과 파일을 갱신한다.
- Python 검사 `python -m unittest discover -s tests -p test_*.py`, 계산 검사 `npm test`, JS 문법 검사 `npm run check`, 브라우저 검사 `npm run test:browser`를 사용한다. 브라우저 검사는 별도의 Playwright 환경이 필요하다.
- 회사 통합 확인은 [운영 명세의 완료 기준](fed-balance-sheet-v3-operations.md#6-개발-완료-확인-기준)을 따른다. 특히 같은 자료의 재실행, 과거 수치 정정, 4,000바이트 경계의 한글, 전환 중 화면 요청, 실패 후 기존 버전 제공을 확인한다.
