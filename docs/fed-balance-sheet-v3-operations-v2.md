# FedBalanceSheet v3 운영 명세 — 개정 2

작성일: 2026-11-25. 화면 버전은 v3이며 이 문서의 버전만 2다. 기존 `fed-balance-sheet-v3-operations.md`는 보존한다. 기존의 완성 JSON·4,000바이트·load/version ID 저장 설계를 이 문서로 대체한다. 이는 사내 구현 명세이며 현재 Python 수집기에 DB 적재가 구현되어 있다는 뜻은 아니다.

## 운영 범위

매일 07:15 KST 전체 사용 이력을 다시 수집한다. 원본 파일과 이전 적재 이력을 장기 보관하지 않는다. H.4.1 전체 XML에서 화면에 필요한 수요일 잔액 계열, ON RRP는 2013-09-23부터, SOFR·EFFR·Repo는 2021-07-28부터, IORB는 RESBM_N.D의 실제 시작일 2021-07-29부터 사용한다. 화면의 주간 시작일은 2013-09-25다. 정확한 URL·계열 목록·필터는 `scripts/ingest.py`를 기준으로 한다. 원천별 발표/휴장 규칙은 기존 명세 1절과 `DATA_UPDATE_SCHEDULE.md`를 따른다.

ZIP 원본을 그대로 DB에 넣지 않는다. 파일을 해석한 후 아래의 필요한 항목과 메타데이터를 텍스트로 직렬화한다. 자료 안의 일자는 연도 구분과 내용 복원에 사용한다. 개별 관측일을 DB 기본키로 삼지 않는다.

## 테이블과 키

아래 컬럼은 모두 필수다. `text`는 논리 이름이며 사내 물리 이름은 `chunk_text`를 권한다. 자료형은 논리 요구사항이며 실제 Altibase DDL은 사내 버전·문자셋에 맞춰 DB 담당자가 확정한다.

| 테이블 | key1 | key2 | key3 | 추가 컬럼 | 기본키 |
|---|---|---|---|---|---|
| FED_H41 | series_id: 문자열 | data_year: 4자리 연도 | group_no: 양의 정수 | chunk_no, text | series_id, data_year, group_no, chunk_no |
| FED_ONRRP | operation_id: 원천 문자열 | group_no: 양의 정수 | 없음 | chunk_no, text | operation_id, group_no, chunk_no |
| FED_SOFR | data_year: 4자리 연도 | group_no: 양의 정수 | 없음 | chunk_no, text | data_year, group_no, chunk_no |
| FED_EFFR | data_year: 4자리 연도 | group_no: 양의 정수 | 없음 | chunk_no, text | data_year, group_no, chunk_no |
| FED_IORB | data_year: 4자리 연도 | group_no: 양의 정수 | 없음 | chunk_no, text | data_year, group_no, chunk_no |
| FED_REPO | operation_id: 원천 문자열 | group_no: 양의 정수 | 없음 | chunk_no, text | operation_id, group_no, chunk_no |

`load_id`는 사용하지 않는다. 거래 ID는 내부 공백과 대소문자를 원천 그대로 보존하고 넉넉한 문자열 길이를 확보한다. 같은 거래 ID에 서로 다른 내용이 있으면 임의 선택하지 않고 적재를 실패시킨다. 동일 내용의 중복은 하나로 제거한다. 연도는 H.4.1·IORB의 TIME_PERIOD, SOFR·EFFR의 effectiveDate에서 얻는다. ON RRP·Repo는 operationId로 구분하고 operationDate는 text에 보존한다.

## text 규격: FED-TEXT-2

DB는 JSON 자료형을 사용하지 않는다. `text`에는 아래 TSV 문자열을 저장한다. 필드 구분은 실제 탭, 행 구분은 LF이며 마지막 행에도 LF를 붙인다. 문자열 내부의 역슬래시·탭·CR·LF는 각각 `\\`, `\t`, `\r`, `\n`으로 이스케이프한다. 값이 없으면 예약 토큰 `\N`을 사용하고 숫자 0과 구분한다. 숫자는 쉼표 없는 십진수, 날짜는 YYYY-MM-DD, 시간은 UTC ISO 형식이다. 복원 후 탭으로 분리하고 이스케이프를 해제한다.

각 논리 자료(계열+연도 / 금리 연도 / 거래 ID)는 다음 M 행 하나와 D 행들로 구성된다. 아래 표에 적힌 필드 순서는 고정이다. 규격 변경 시 형식 버전을 올린다.

| 원천 | M 행 필드 순서 | D 행 필드 순서 |
|---|---|---|
| H41 | M, FED-TEXT-2, H41, source_url, fetched_at, prepared, series_id, internal_key, unit, basis, description | D, TIME_PERIOD, value |
| SOFR/EFFR | M, FED-TEXT-2, 원천명, source_url, fetched_at, Percent | D, effectiveDate, percentRate |
| IORB | M, FED-TEXT-2, IORB, source_url, fetched_at, RESBM_N.D, Percent | D, TIME_PERIOD, value |
| ONRRP/REPO | M, FED-TEXT-2, 원천명, source_url, fetched_at, USD | D, operationId, operationDate, settlementDate, operationType, term, auctionStatus, totalAmtAccepted, note |

H41의 unit은 USD millions, basis는 Wednesday level이다. 날짜 없는 원천 메타데이터도 M 행으로 보존하므로 별도의 원본 보관이 필요하지 않다. 같은 원천의 반복 M 행들은 서로 일치해야 한다(계열별 설명 등 원래 달라지는 필드는 제외). H41 prepared로 화면 releaseDate를 만든다. 소스 URL은 실제 요청 URL 또는 원천 전체 파일 URL이다. 조회 서버는 접근 불가능한 로컬 원본 경로를 화면에 노출하지 않는다.

레포 두 테이블은 현재 수집기와 동일하게 Results·Overnight 및 각각 Reverse Repo/Repo 거래만 저장한다. Repo의 note에 small value exercise가 있으면 제외한다. 필터 결과와 제외 건수는 수집 작업의 성공 로그에 남긴다. 저장 전 거래별 금액과 날짜를 검증한다. DB 조회에서 operationId를 다시 확인한 뒤 operationDate별 합산한다. 금액은 원천 USD를 보존하고 조회 단계에서 1,000,000으로 나눈다. 거래 세부 담보·입찰금액 등 현재 화면에 쓰지 않는 항목은 이 규격에 포함하지 않는다.

## 분할·복원

1. 각 논리 자료에 M 행과 날짜순 D 행을 만든다. 레포는 거래 하나당 D 행 하나다.
2. 회사 DB 문자셋으로 인코딩할 수 있는지 검사한다. 문자 경계를 보존하면서 각 조각이 실제 저장 2,000바이트 이하가 되게 나눈다. 2,000글자가 아니다. 문자 경계 때문에 조각을 정확히 2,000바이트까지 채우지 못해도 정상이다.
3. 연속 조각 7개까지 group_no=1에 넣고, 다음 조각부터 group_no=2로 증가시킨다. 각 그룹의 chunk_no는 1부터 다시 시작한다. 마지막 그룹은 1~7개다. 그룹은 최대 14,000바이트이며 문자 경계를 고려한 실제 용량은 더 작을 수 있다.
4. 한 원래 논리 자료를 읽을 때 group_no, chunk_no를 숫자 오름차순으로 조회하고 text를 구분자 추가 없이 연결한다. 행 중간에서 잘린 조각도 허용하되 전체 복원 후에만 TSV를 해석한다.
5. 모든 번호의 연속성과 1~7 범위, 복원된 필드 수, 날짜·계열·연도 일치, 중복을 검사한다. 적재 프로그램은 적재 전후 논리 자료의 SHA-256과 행 수를 대조한다. 검사값은 DB 조회가 아닌 적재 검증에도 필요하므로 작업 동안 메모리 또는 임시 파일에 유지한다.

## 전체 교체와 실패 처리

여섯 원천을 모두 수집·검증하고 동일 구조의 임시 테이블/임시 적재 영역에 준비한다. 원천 수집이나 파싱 실패 시 운영 테이블을 삭제하지 않는다. 전체 이력을 재수집하더라도 읽기 도중 신구 자료가 섞이지 않도록 교체 절차가 필요하다.

DB 담당자는 여섯 운영 테이블을 하나의 트랜잭션으로 교체하는 방식을 검증한다. DB 조회는 여섯 테이블을 일관된 시점에 읽어야 한다. 사내 환경에서 이를 보장하기 어렵다면 교체 동안 조회를 잠시 차단하고 완료 후 재개한다. 비트랜잭션 TRUNCATE/DDL을 안전한 교체로 가정하지 않는다. 검증 완료 후 새 자료 공개, 진행 중 조회 종료, 이전 임시 자료 삭제 순서를 지킨다. 수집 시각만 바뀐 경우에는 의미 있는 내용 비교로 불필요한 교체를 생략할 수 있다.

## 담당자별 산출물과 완료 기준

구체적인 역할·응답 규격·샘플은 [구현 인계 명세 개정 2](v3-implementation-handoff-v2.md)를 따른다. 개발 완료에는 원천별 DB 적재, 전체 교체, 조회 서버의 기존 화면 응답 재구성, 화면 시작/새로고침 수정이 모두 필요하다.

- 조각당 2,000바이트, 그룹당 7개 이하 및 문자열 완전 복원이 확인되어야 한다.
- 결측과 0, 두 건 이상의 같은 날 레포 거래, 과거 정정, 삭제된 과거 관측치 반영을 확인한다.
- 소스 실패·저장 실패·중간 조각 누락 시 이전 정상 자료가 제공되어야 한다.
- 기존 화면과 겹치는 구간의 주간/일간 값·1/4/13주 변화·출처·발표일이 일치해야 한다.
- 저장 규격 자체는 장기 원본 아카이브나 모든 원천 필드의 보존을 보장하지 않는다. 현재 v3에 필요한 항목을 보존한다.
