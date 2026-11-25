# FedBalanceSheet v3 구현 인계 명세 — 개정 2

2026-11-25. 기존 `v3-implementation-handoff.md`는 보존한다. 이 문서와 [운영 명세 개정 2](fed-balance-sheet-v3-operations-v2.md)가 신규 사내 구현의 기준이다. 현재 화면 HTML 버전은 v3다.

## 담당자와 인계물

| 담당자 | 구현 작업 | 다음 담당자에게 전달 |
|---|---|---|
| 입수 | 매일 07:15 KST 전체 이력 수집, XML/JSON 해석, 필수 계열·거래 필터, 중복·결측 검증, FED-TEXT-2 생성, 문자셋별 2,000바이트 분할 | 여섯 테이블별 key/chunk/text 행, 원천별 범위·건수·검사값·성공/실패 결과 |
| DB | 원천별 기본키와 1~7 조각 제한, 적재 영역, 일관된 전체 교체, 실패 시 이전 정상 데이터 유지 | 테이블 정의, 접속/권한, 정렬 조회 방식, 교체와 조회 일관성 규칙 |
| DB 조회 | 논리 자료별 text 복원·해석, 원천 단위 확인, 날짜 결합, 파생값·품질 검사, 응답 구성 | GET /api/h41의 완성 응답 및 오류 규격 |
| 화면 | 기존 HTML/assets 배포, DB 조회 응답으로 시작, 최신 저장 자료 재조회, 로딩·실패 표시 | 기존 화면과 일치하는 차트/표 및 통합 검증 결과 |

파일 입수 프로그램은 수집과 적재 검증을 담당한다. DB 자체에 원천 파싱·금융 계산을 맡기지 않는다. DB 조회 담당자는 파싱·계산이 가능한 서버 프로그램까지 담당하거나 사내 서버 개발자와 이 작업을 배분해야 한다. SQL 조회만으로 작업이 끝나지 않는다.

## DB 조회 처리 규칙

H41 계열은 `scripts/ingest.py`의 SERIES와 연결한다. read_h41/read_reference_rate/read_iorb/read_rrp/read_standing_repo의 검증 규칙을 FED-TEXT-2 입력에 적용하고 normalize, normalize_funding_daily, validate와 동등한 결과를 만든다. 원천 파일 파서에 TSV를 그대로 전달할 수는 없으므로 TSV 복원 어댑터가 추가로 필요하다.

- H41 금액은 USD millions 유지. 레포 원천 낙찰액 USD를 합산 후 1,000,000으로 나눈다.
- 주간 행에는 동일 수요일 값만 연결한다. 다른 날짜 값으로 보충하지 않는다.
- 순유동성 = totalAssets − treasuryGeneralAccount − onRrp. 입력 결측이면 결과도 null.
- 일간 행의 날짜 집합은 SOFR/EFFR/Repo의 날짜 합집합이다. IORB는 같은 날짜 값만 붙인다.
- 금리 차이는 (SOFR 또는 EFFR − IORB) × 100 bp. 결측은 null, 실제 0은 숫자 0.
- 레포의 거래 ID 목록도 유지한다. 같은 ID의 상충 결과를 조용히 덮어쓰지 않는다.
- H41 합계 대사, 국채 구성, otherAssetItems/otherLiabilities 등은 기존 코드와 동일하게 계산한다.

## 화면 전달 계약

정상: GET /api/h41, HTTP 200, Content-Type: application/json; charset=utf-8. DB에는 TSV 문자열을 저장해도 서버의 HTTP 응답은 기존 화면이 사용하는 JSON이다.

| 항목 | 규격 |
|---|---|
| meta | status=actual, unit=USD millions, observationBasis=wednesday_level, observationDate, releaseDate, fetchedAt, historyStart, fundingObservationDate, 출처 정보 |
| history | 날짜 오름차순 수요일 행. 기존 latest.json의 원천·파생 필드 유지. 마지막 날짜=meta.observationDate |
| fundingDaily | 날짜 오름차순 일간 금리/레포/금리차 행, 결측은 null |
| quality | 기존 validate 결과와 필터 제외 건수. 관측 누락과 실제 0 구분 |
| provenance | seriesMap, 출처 URL, 단위 변환·결합·계산 기준. 로컬 원본 파일 경로 대신 사내 저장 규격을 설명 |

전체 필드의 기준은 `data/normalized/latest.json`, `assets/data.js`의 validateSnapshot, `assets/app.js`의 소비 필드다. 화면을 임의의 단순 숫자 목록에 맞추지 않는다. 기간 변화는 assets/data.js의 날짜 기준 계산을 재사용할 수 있다. 화면의 1/4/13주 비교를 지원하려면 전체 이력이 필요하다.

읽기 실패·불완전 자료일 때는 HTTP 503과 {"error":"snapshot_unavailable"}를 반환한다. HTTP 200으로 빈 정상 응답을 만들지 않는다. 클라이언트는 이미 표시 중인 정상 자료를 유지하면서 오류를 표시한다. 서버는 재구성 완료 응답을 캐시할 수 있으나 자료 교체 후 함께 갱신해야 한다.

## 화면 담당 변경 범위

`FedBalanceSheet_v3.html`과 assets의 CSS·폰트·Vue·i18n·app/data 코드를 함께 배포한다. HTML 한 파일만 배포하지 않는다. 현재 시작 시 actual-data.js 번들을 먼저 표시하는 동작은 서버 모드에서 GET /api/h41 완료 후 표시하도록 변경한다. 새로고침은 GET /api/h41 재조회로 바꾸고 POST /api/refresh의 즉시 원천 수집과 분리한다. 정적 파일과 API는 같은 사이트에서 제공한다. 이 변경과 Altibase 연결은 아직 구현되지 않았다.

## 샘플 묶음

[samples/v2](samples/v2/)에는 여섯 원천별 `*.rows.json`과 `*.text.tsv`, `dashboard-response.sample.json`, `README.md`, `validate.cjs`를 제공한다. rows.json은 DB 적재 행을 전달하기 위한 샘플 포장 형식이며 JSON 파일을 DB에 통째로 저장하라는 뜻이 아니다. 각 객체의 key와 chunk_no, text를 각각 컬럼에 넣는다.

샘플은 저장소의 2026-10-21 관측치와 로컬에 입수되어 있던 같은 날 거래 결과를 발췌했다. 한 날짜뿐이므로 1/4/13주 비교 검증용으로 사용할 수 없다. 전체 응답 구조와 장기 비교의 기준은 현재 latest.json이다. 샘플의 prepared/releaseDate는 사용한 스냅샷의 2026-10-29를 보존한다(2026-10-21 관측치 최초 발표일이라는 뜻이 아니다).

`node docs/samples/v2/validate.cjs`로 바이트/번호/복원·레포합산·금리차·순유동성·화면 응답 검사를 실행한다. 이 검사는 Altibase 접속 또는 사내 문자셋에서의 실증 테스트를 대신하지 않는다. 사내 통합에서는 전체 이력, 교체 동시 조회, 2,000바이트 한글 경계, 8번째 조각의 다음 그룹 이동, 원천 실패, 과거 정정을 추가 확인한다.
