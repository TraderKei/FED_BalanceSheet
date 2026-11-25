# FedBalanceSheet v3 구현 인계 명세 — 개정 4

2026-11-25. [운영 명세 개정 4](fed-balance-sheet-v3-operations-v4.md)와 함께 사용한다. 원천별 6개 DB 테이블을 운영 대상에서 제외하고 FED_SCREEN_DATA만 저장한다. 기존 원천별 TSV 규격과 샘플은 과거 설계 참고 자료다. 기존 파일은 보존한다.

| 담당자 | 해야 할 작업 | 전달물 |
|---|---|---|
| 입수 | 전체 원천 임시 수집, 여섯 원천 결합·계산·검증, 완성 화면 JSON 직렬화·분할·적재 검증 | FED_SCREEN_DATA 행과 적재 검증 결과 |
| DB | 테이블/기본키/제약, 임시 적재와 일관된 전체 교체, 권한 관리 | 테이블과 SELECT 가능 상태 |
| DB 조회 | 운영 명세의 SELECT 실행. 정렬된 결과 전체 제공 | group_no, chunk_no, chunk_text, total_chunks, payload_sha256 행 목록 |
| 화면 | 기존 사내 조회 통신 연결, 조각 순서·개수·해시 확인, 문자열 연결·JSON.parse·validateSnapshot, 표·차트 표시 | 완성된 v3 화면 |

DB 조회 담당자에게 TSV 해석, 원천별 조인, 금액 환산, 금융 계산, JSON 작성 또는 서버 개발을 요구하지 않는다. 통신은 기존 사내 조회 기능을 전제로 하며 그 기능이 반환하는 컬럼 이름/배열 형태에 맞춘 화면 어댑터가 필요하다.

## 화면 전달 규격

조회 결과는 운영 명세의 다섯 컬럼을 갖는 행 목록이다. samples/v3/FED_SCREEN_DATA.rows.json은 행 목록을 JSON으로 표현한 예시이며 실제 사내 전송 포맷은 기존 조회 기능을 따른다. 각 행의 chunk_text는 원본 문자열 그대로 보존한다.

화면 어댑터는 다음 순서로 처리한다.

1. 오류/빈 결과/조회 잘림 확인.
2. group_no와 chunk_no가 기대 순서이며 중복·누락이 없는지 확인. total_chunks와 실제 행 수 및 모든 행의 메타값 일치 확인.
3. chunk_text만 순서대로 연결. 구분자 추가와 trim 금지.
4. 연결 문자열 UTF-8의 SHA-256을 payload_sha256과 대조. 브라우저 또는 기존 앱 환경에서 지원하는 해시 기능 사용.
5. JSON.parse 후 assets/data.js의 validateSnapshot 적용, 성공 시 화면 자료 교체.

완성 객체에는 meta/history/fundingDaily/quality/provenance를 포함한다. meta는 status=actual, unit=USD millions, observationBasis=wednesday_level, 주간·일간 기준일, 발표일, 수집 시각과 출처를 포함한다. history는 날짜 오름차순 수요일 이력이며 마지막 날짜와 meta.observationDate가 같아야 한다. fundingDaily는 날짜 오름차순 일간 이력이다. quality는 결측·대사·제외 거래 결과, provenance는 계열 대응·출처·계산 기준을 담는다. 전체 필드 기준은 data/normalized/latest.json 및 assets/data.js, assets/app.js의 실제 소비 필드다. 완성 객체를 만드는 책임만 입수 단계로 이동한다. 원천 자료가 없는 날은 null, 실제 0은 0이다. 단위·날짜 결합·파생값 검증은 입수 단계에서 끝낸다.

## 현재 코드에서 변경할 곳

- scripts/ingest.py: 기존 완성 snapshot 생성 결과를 사내 DB 문자열 행으로 저장하는 적재 기능 추가. 현 코드가 원본을 날짜별로 보존하는 동작은 회사 운영 요구에 맞게 임시 파일 교체/정리로 변경해야 한다.
- assets/data.js: 현재 HTTP 모드의 /api/h41 직접 완성 객체 수신을 사내 SELECT 결과 복원 어댑터로 연결. 사내 통신 함수명은 해당 환경에서 확정한다.
- assets/app.js 및 HTML 시작 경로: actual-data.js의 과거 번들 데이터를 먼저 표시하지 않도록 최초 조회 대기. 새로고침은 저장된 자료의 SELECT 재실행으로 변경.
- scripts/serve.py: 로컬 개발용으로 유지 가능. 이를 DB 조회 담당자가 운영 서버로 확장해야 한다고 요구하지 않는다.
- 정적 배포: HTML, CSS, Vue, i18n, app/data 코드와 폰트를 함께 배포한다.

이 문서 작업은 위 런타임 변경을 구현한 것이 아니다. 샘플의 검증 코드는 연결 방식 확인용이다.

## 샘플과 검증

- samples/v2의 원천별 테이블 샘플은 이번 구현에서 사용하지 않는다.
- samples/v3/FED_SCREEN_DATA.rows.json: 완성 화면용 문자열을 분할한 유일한 운영 테이블 샘플.
- samples/v3/dashboard-response.sample.json: 위 조각을 합쳐 해석한 기대 객체. 개정 2의 한 날짜 실제 자료 예제를 재사용하며 최신 시세가 아니다.
- samples/v3/validate.cjs: 샘플과 현재 전체 latest.json을 이용한 UTF-8 분할/복원, 누락·혼입, 기존 화면 계약 검사.

실행: `node docs/samples/v3/validate.cjs`. 사내 DB 문자셋, Altibase 실제 적재·교체, 브라우저 통신은 별도 통합 검증 대상이다. 현재 전체 자료 테스트는 메모리 안에서 수행하며 운영 DB를 변경하지 않는다.

## 이 개정의 적용 범위

개정 3의 화면용 다섯 컬럼과 분할/복원 규격이 같으므로 samples/v3를 그대로 재사용한다. 샘플의 버전 폴더 이름은 변경하지 않는다. 실제 Altibase 연결·스케줄러·적재·화면 통신 어댑터는 아직 구현되지 않았다. 파일 보관을 포함한 기존 로컬 실행 동작과 회사 운영 설계를 구분한다.
