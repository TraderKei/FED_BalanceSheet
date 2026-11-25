# FED_BalanceSheet

회사 운영의 최신 기준은 **개정 5: FED_SCREEN_DATA만 저장**하는 구성입니다. 입수 프로그램이 6개 원천의 결합·계산·검증을 끝내고, DB 조회는 SELECT 결과만 전달하며 화면은 문자열 조각을 복원합니다.

- [운영 명세 개정 5](docs/fed-balance-sheet-v3-operations-v5.md)
- [담당자별 구현 인계 명세 개정 5](docs/v3-implementation-handoff-v5.md)
- [개발팀 안내 및 샘플](docs/README.md)
- [이전 프로젝트 README](README-before-v5.md): 개정 4의 안내를 보존한 참고 자료. 사내 운영 규격은 개정 5가 우선합니다.

최종 화면은 FedBalanceSheet_v3.html입니다. 이 저장소에는 로컬 수집·계산·화면 코드와 인계 명세가 있으며, 사내 Altibase 적재·예약 실행·조회 통신 연결은 별도 구현 대상입니다.
