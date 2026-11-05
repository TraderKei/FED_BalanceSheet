# v3 회사 개발팀 인계 안내

## 읽는 순서와 적용 기준

1. [v3 사내 운영 작업 명세](fed-balance-sheet-v3-operations.md)에서 매일 07:15 KST 수집, 전체 이력, 검증 주체, Altibase 칼럼, 버전 교체 순서를 확인한다.
2. [v3 구현 연결 명세](v3-implementation-handoff.md)에서 실제 파일, 데이터 구조, 수집 프로그램과 화면 서버의 연결 지점을 확인한다.
3. [원천 데이터 발표 주기](DATA_UPDATE_SCHEDULE.md)에서 공식 발표 시각과 회사의 매일 07:15 KST 전체 이력 수집 시각을 구분해 확인한다.
4. [기존 프로젝트 README](PROJECT-README.md)와 [기존 UI 안내](UI-GUIDE.txt)는 초기 설계와 v1 안내를 보존한 참고 자료다. 회사 운영 일정, API, 화면 파일, 수집 시작일은 위 1~2번 문서를 따른다.

## 실제 구현 파일

문서는 이 폴더에 모았고, 실행에 필요한 코드와 화면은 원래 위치에 둔다.

- [최종 화면](../FedBalanceSheet_v3.html)
- [원천 수집 및 JSON 생성](../scripts/ingest.py)
- [현재 로컬 서버](../scripts/serve.py)
- [화면 데이터 연결](../assets/data.js)
- [화면 동작](../assets/app.js)
- [현재 JSON 예시](../data/normalized/latest.json)
- [현재 품질 보고서](../data/quality-report.json)
- [화면 문구 대조표](../language-table.csv)

회사 Altibase 접속 정보, 회사 서버 구현체, 작업 예약 설정은 이 저장소에 없다. 개발팀이 회사 환경에서 연결한다.
