# 📊 서버-클라이언트 프로젝트 참조 문서

## 🎯 프로젝트 개요
게임 자동화 관리를 위한 실시간 클라이언트 모니터링 시스템. 여러 게임 클라이언트가 중앙 서버로 상태를 보고하고, 웹 대시보드를 통해 시각화 및 INI 파일로 원격 명령을 실행하는 시스템입니다.

## 🏗️ 시스템 아키텍처

### 핵심 구성요소
- **TCP 서버** (`server.py`): 포트 5050에서 클라이언트 상태 데이터 수신
- **게임 클라이언트** (`client.py`): HTTP/TCP로 상태 보고, 포트 6000에서 명령 대기
- **웹 대시보드** (`board/app.py`): 포트 8000의 Flask 서버로 모니터링 UI 제공
- **데이터베이스**: SQLite (`client_status.db`)에 클라이언트 상태 및 이력 저장

### 데이터 흐름
```
게임 클라이언트 → HTTP (포트 8123) → TCP 서버 (포트 5050) → SQLite DB
                ↑                                           ↓
          명령 수신                                   웹 대시보드 (포트 8000)
          (포트 6000)                                      ↓
                ↑                                    웹 인터페이스
          INI 명령 ←――――――――――――――――――――――――――――――――
```

## 📁 디렉토리 구조

```
📦 server_client_project1/
├── 🖥️ server/               # 메인 TCP 서버
│   ├── server.py            # 핵심 서버 로직 (포트 5050)
│   ├── settings.json        # 서버 설정
│   └── client_status.db     # SQLite 데이터베이스
├── 👥 client/               # 게임 클라이언트 애플리케이션
│   ├── client.py            # 클라이언트 상태 보고기
│   └── config.json          # 클라이언트 설정
├── 🌐 board/                # 웹 대시보드 (Flask)
│   ├── app.py               # Flask 웹 서버 (포트 8000)
│   └── server_send.py       # INI 명령 전송기
├── 🎨 js/                   # 모듈화된 JavaScript
│   ├── core/                # API, 상태, 유틸리티
│   ├── dashboard/           # 카드 관리, 필터
│   ├── charts/              # 데이터 시각화
│   └── modals/              # 명령 인터페이스
├── 🎨 css/                  # 스타일시트
└── 📄 index.html            # 메인 대시보드 인터페이스
```

## 🔑 핵심 파일 및 역할

### 서버 구성요소
- **`server/server.py`**: TCP 리스너, 배치 DB 작업, 클라이언트 상태 모니터링
- **`server/settings.json`**: 서버 IP (172.30.101.232), 포트, 주기 설정
- **`server/client_status.db`**: 테이블: `clients`, `daily_dia`, `ini_commands`

### 클라이언트 구성요소
- **`client/client.py`**: HTTP 서버 (8123), TCP 명령 수신기 (6000), 스텔스 모드
- **`client/config.json`**: 대상 프로세스 (VM_Flow_*.exe), 서버 엔드포인트

### 웹 인터페이스
- **`board/app.py`**: REST API (/api/clients, /api/dia-history), INI 명령 전송
- **`index.html`**: 드래그-드롭 카드, 필터, 검색 기능의 실시간 대시보드
- **`js/main.js`**: 애플리케이션 진입점, 모듈 초기화

## 🚀 핵심 기능

### 1. 실시간 모니터링
- IP, 게임 서버, 다이아몬드 수를 표시하는 클라이언트 상태 카드
- 자동 새로고침 (30초-1시간 간격)
- 상태 표시기 및 오프라인 감지

### 2. 데이터 관리
- 동시 접근을 위한 WAL 모드의 SQLite
- 성능을 위한 배치 처리
- 일일 다이아몬드 이력 추적

### 3. 원격 제어
- 선택된 클라이언트에 INI 명령 배포
- 공통 명령용 템플릿 시스템
- 실행 로깅 및 상태 추적

### 4. 웹 인터페이스
- 정렬/필터링 가능한 클라이언트 카드
- 다이아몬드 수 범위 필터링
- 이름/서버로 검색
- 다이아몬드 이력 차트 시각화

## 🔌 API 엔드포인트

### 대시보드 API
- `GET /api/clients` - 현재 클라이언트 상태 목록
- `GET /api/dia-history?days=7` - 다이아몬드 이력 데이터
- `GET /api/server-status` - 서버 상태 확인
- `POST /api/send-ini` - 클라이언트에 INI 명령 전송
- `POST /api/start-server` - 서버 프로세스 시작

### 클라이언트 HTTP 인터페이스
- `GET /send?ip=X&name=Y&dia=Z&game=G&server=S&msg=M` - 상태 업데이트

## 💾 데이터베이스 스키마

### clients 테이블
```sql
name TEXT PRIMARY KEY, ip TEXT, game TEXT, server TEXT,
dia INTEGER, last_report TEXT, status TEXT, message TEXT
```

### daily_dia 테이블
```sql
date TEXT, name TEXT, ip TEXT, game TEXT, server TEXT,
dia INTEGER, status TEXT, message TEXT
PRIMARY KEY (date, name)
```

## ⚙️ 중요 함수

### 서버 (`server.py`)
- `handle_client()` - 들어오는 클라이언트 연결 처리
- `batch_processor()` - 백그라운드 DB 배치 작업
- `watch_ahk()` - 클라이언트 상태 모니터링 (58초 타임아웃)

### 클라이언트 (`client.py`)
- `send_to_server()` - 메인 서버에 상태 보고
- `CommandReceiver.run()` - INI 명령 수신 대기
- `is_target_running()` - 스텔스 모드 프로세스 감지

### 웹 (`app.py`)
- `api_clients()` - 실시간 클라이언트 데이터 제공
- `send_ini_command()` - 로깅과 함께 명령 배포

## 🛠️ 일반적인 문제 및 해결책

### 연결 문제
- **서버 연결 불가**: IP 172.30.101.232, 포트 5050/8000 확인
- **클라이언트 보고 안됨**: config.json 서버 설정 확인
- **데이터베이스 잠김**: 서버 재시작 (WAL 모드가 이를 방지해야 함)

### 성능 문제
- **느린 대시보드**: batch_processor() 큐 크기 확인
- **메모리 사용량**: SQLite WAL 파일 증가 모니터링
- **업데이트 지연**: 대시보드 새로고침 간격 확인

## 📋 최근 수정 사항 (2025년 1월)

### 주요 버그 수정
- **카드 드래그앤드롭**: Sortable Swap 플러그인 활성화 (`swap: true`)로 2개 카드만 교체
- **빈 카드 편집**: 더블클릭으로 텍스트 입력, localStorage에 자동 저장
- **줄 체크박스**: 커스텀 번호 표시 (01, 02, 03...) 중앙 정렬
- **번호순 정렬**: `autoSortByNumbers()` 함수 복구 - 320개 카드 자동 배치

## ⚠️ 중요 주의사항

### 카드 시스템
- **총 카드 수**: 320개 고정 (20열 × 16행)
- **중복 카드**: 동일 번호는 하단에 자동 배치
- **빈 카드**: `empty-숫자` 형태로 관리
- **간결모드/전체모드**: 전환 시 레이아웃과 체크박스 상태 유지

### 성능 최적화
- `fetchClients()` 호출 시 Sortable 재초기화 주의
- 배치 처리로 DB 작업 최소화
- 60초마다 자동 새로고침 (기본값)

## 📦 JavaScript 모듈 상세 구조

### Core 모듈 (`js/core/`)
- **`api.js`**:
  - `fetchClients()` - 클라이언트 데이터 가져오기 및 UI 렌더링
  - `sendIniCommand()` - INI 명령 전송
  - `checkServerStatus()` - 서버 상태 확인
  - Sortable.js 드래그앤드롭 설정

- **`state.js`**:
  - 전역 상태 관리 (condensed, refreshInterval, clientOrder)
  - localStorage 연동

- **`utils.js`**:
  - 유틸리티 함수 (debounce, formatDate, trimTimestamp)

### Dashboard 모듈 (`js/dashboard/`)
- **`cards.js`**:
  - `autoSortByNumbers()` - 번호순 자동 정렬
  - `deleteCard()` - 빈 카드 삭제
  - `toggleCardSelection()` - 카드 선택/해제
  - `toggleRowSelection()` - 줄 단위 선택

- **`filters.js`**:
  - `applyFilters()` - 검색 및 필터 적용
  - `filterByDiaRange()` - 다이아 범위 필터

### Modals 모듈 (`js/modals/`)
- **`ini-command.js`**:
  - `openCommandModal()` - INI 명령 모달 열기
  - `loadTemplate()` - 템플릿 불러오기
  - `saveCustomTemplate()` - 커스텀 템플릿 저장

## 🧪 주요 기능 테스트 체크리스트

### 카드 드래그앤드롭
✅ 좌우 드래그 시 2개만 교체
✅ 상하 드래그 시 2개만 교체
✅ 중간 카드들이 밀리지 않음

### 빈 카드 편집
✅ 더블클릭으로 편집 모드 진입
✅ Enter로 저장, Esc로 취소
✅ 새로고침 후에도 텍스트 유지
✅ 삭제 버튼으로 완전 제거

### 번호순 정렬
✅ 320개 카드 정확히 배치
✅ 중복 번호는 하단 추가
✅ 빈 카드 자동 생성

### INI 명령 전송
✅ 체크된 카드만 선택
✅ 줄 체크박스로 20개씩 선택
✅ 템플릿 저장/불러오기
✅ 전송 로그 확인

## 🔧 디버깅 팁

### 콘솔 명령어
```javascript
// 현재 상태 확인
dashboardDebug.getState()

// 모듈 로드 확인
dashboardDebug.showModuleInfo()

// 설정 초기화
dashboardDebug.resetSettings()
```

### 문제 해결
- **카드가 안 보임**: `fetchClients()` 콘솔에서 실행
- **드래그 안됨**: Sortable.swap.min.js 로드 확인
- **빈 카드 텍스트 사라짐**: localStorage 확인
- **줄 체크박스 어긋남**: 간결모드 토글 후 재확인

## 🚀 빠른 명령어

### 시스템 시작
```bash
# 터미널 1: 메인 서버 시작
cd server && python server.py

# 터미널 2: 웹 대시보드 시작
cd board && python app.py

# 터미널 3: 클라이언트 시작 (각 머신에서)
cd client && python client.py
```

### 데이터베이스 접근
```bash
# 현재 클라이언트 보기
sqlite3 server/client_status.db "SELECT * FROM clients"

# 일일 이력 확인
sqlite3 server/client_status.db "SELECT * FROM daily_dia WHERE date = date('now')"

# INI 명령 로그 확인
sqlite3 server/client_status.db "SELECT * FROM ini_commands ORDER BY timestamp DESC LIMIT 10"
```

### 설정
- **서버 IP**: `server/settings.json`과 `client/config.json` 수정
- **포트**: 서버(5050), 웹(8000), 클라이언트-HTTP(8123), 클라이언트-CMD(6000)
- **대상**: `client/config.json` targets 배열에 프로세스 이름 추가

## 📝 개발 규칙

### 코드 수정 시
1. 기존 코드 스타일 유지
2. 주석은 한글로 작성
3. 콘솔 로그는 이모지 활용 (✅, ❌, ⚠️, 📊)
4. localStorage 키는 camelCase 사용

### Git 커밋 메시지
```
fix: 카드 드래그앤드롭 스왑 문제 수정
feat: 빈 카드 편집 기능 추가
refactor: API 모듈 구조 개선
```

---
*AI 어시스턴트 참조용 생성 - 필수 프로젝트 탐색 정보 포함*
*마지막 업데이트: 2025년 1월*