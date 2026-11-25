# v3 회사 개발팀 인계 안내 — 개정 5

최신 운영 기준은 **FED_SCREEN_DATA 하나만 저장**하는 구성이다. 원천별 6개 테이블과 FED-TEXT-2 저장 규격은 사용하지 않는다. 입수 프로그램이 원천 수집·결합·계산·검증과 화면용 문자열 분할을 수행한다. DB 조회 담당자는 SELECT 결과만 전달하고, 화면 담당자는 문자열을 복원해 표시한다.

## 읽는 순서

1. [운영 명세 개정 5](fed-balance-sheet-v3-operations-v5.md): 유일한 운영 데이터 테이블, 2,000바이트·7조각, load_id 없는 교체, 수집 범위.
2. [담당자별 구현 인계 명세 개정 5](v3-implementation-handoff-v5.md): 역할, 전달 규격, 코드 연결 지점.
3. [수집 일정 안내 개정 5](DATA_UPDATE_SCHEDULE-v5.md): 매일 07:15 KST 전체 이력 수집. 공식 발표 시각의 기존 확인일은 문서에 명시되어 있다.
4. [화면 운영 안내 개정 5](UI-GUIDE-v5.txt): 최초 조회·새로고침·실패 시 동작.

## 사용하는 샘플

해시 컬럼을 제외한 네 컬럼 전용 샘플을 사용한다.

- [FED_SCREEN_DATA 적재 행](samples/v5/FED_SCREEN_DATA.rows.json)
- [복원 후 화면 객체](samples/v5/dashboard-response.sample.json)
- [분할·복원 검사](samples/v5/validate.cjs): 저장소 루트에서 node docs/samples/v5/validate.cjs

샘플은 한 날짜 자료이며 최신 시세나 전체 기간 비교 예제가 아니다. 검사 프로그램은 현재 전체 latest.json의 메모리 분할·복원도 검사한다. Altibase 접속·사내 문자셋·실제 교체·브라우저 연결은 별도 검증한다.

## 실제 구현과 남은 작업

- [최종 화면](../FedBalanceSheet_v3.html), [수집·계산](../scripts/ingest.py), [화면 데이터 연결](../assets/data.js), [화면 동작](../assets/app.js)
- [전체 데이터 형식 예시](../data/normalized/latest.json), [로컬 서버](../scripts/serve.py)

사내 DB 적재, 원본 임시 파일 정리, 예약 실행, 사내 조회 통신 어댑터는 아직 구현되지 않았다. 로컬 서버의 API와 파일 보존 동작을 회사 운영 완료 상태로 해석하지 않는다.

## 이전 문서

[개정 전 인계 안내](README-before-v5.md), 원본 운영 명세와 개정 2·3·4, PROJECT-README.md, 이전 UI 안내 및 samples/v2는 보존된 참고 자료다. 서로 다른 저장 설계를 섞어 구현하지 않고 개정 5를 우선한다.
