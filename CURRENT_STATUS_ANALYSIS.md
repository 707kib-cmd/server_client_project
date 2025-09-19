# 🎯 서버-클라이언트 프로젝트 현재 상태 분석

## 📋 프로젝트 개요
게임 클라이언트 상태 모니터링 + INI 명령 전송 시스템

---

## 🏗️ 전체 구조 (한눈에 보기)

```
📁 server_client_project1/
├── 🖥️ server/                    # TCP 서버 (포트 5050)
│   ├── server.py                 # 클라이언트 상태 수신 서버
│   ├── settings.json             # 서버 설정
│   └── client_status.db          # SQLite 데이터베이스
├── 🌐 board/                     # 웹 대시보드 (포트 8000)
│   ├── app.py                    # Flask 웹서버
│   ├── server_send.py            # INI 전송 모듈
│   ├── templates/dashboard.html  # 메인 대시보드 UI
│   └── static/dashboard.js       # 프론트엔드 로직
└── 💻 client/                    # 클라이언트 (각 게임PC)
    ├── client.py                 # 상태 보고 클라이언트
    └── config.json               # 클라이언트 설정
```

---

## 🔄 데이터 흐름 (현재 구현 상태)

### 1️⃣ 상태 모니터링 흐름
```
게임PC (client.py) → server.py (5050) → SQLite DB
                                    ↑
웹 브라우저 ← Flask (8000) ← dashboard.js (5초마다)
```

### 2️⃣ INI 명령 전송 흐름 ⭐ **NEW**
```
웹 대시보드 → Flask API → server_send.py → 게임PC (5050)
                                      ↓
                             SQLite DB (이력 저장)
```

---

## 📊 데이터베이스 구조

### 🗃️ SQLite Tables (`client_status.db`)

```sql
-- 실시간 클라이언트 상태
clients (
    name TEXT PRIMARY KEY,      # 클라이언트명
    ip TEXT,                   # IP 주소
    game TEXT,                 # 게임명
    server TEXT,               # 서버명
    dia INTEGER,               # 다이아 수량
    last_report TEXT,          # 마지막 보고 시간
    status TEXT,               # 상태 (alive)
    message TEXT               # 메시지
)

-- 일별 다이아 히스토리
daily_dia (
    date TEXT,                 # 날짜
    name TEXT,                 # 클라이언트명
    ip TEXT,                   # IP 주소
    game TEXT,                 # 게임명
    server TEXT,               # 서버명
    dia INTEGER,               # 다이아 수량
    status TEXT,               # 상태
    message TEXT,              # 메시지
    PRIMARY KEY (date, name)
)

-- INI 명령 이력 ⭐ NEW
ini_commands (
    id INTEGER PRIMARY KEY,
    client_ip TEXT,            # 대상 IP
    client_name TEXT,          # 대상명
    filename TEXT,             # INI 파일명
    command_content TEXT,      # INI 내용
    sent_timestamp DATETIME,   # 전송 시간
    execution_status TEXT,     # 상태 (PENDING/SUCCESS/FAILED)
    execution_timestamp DATETIME, # 실행 시간
    execution_result TEXT,     # 실행 결과
    error_message TEXT         # 오류 메시지
)
```

---

## 🌐 웹 대시보드 기능

### 📄 dashboard.html
```html
<!-- 핵심 UI 요소 -->
🔍 검색/필터 바 → 다이아 수량, 텍스트 필터
🎛️ 우측 상단 → 간결모드, INI전송, 시간기준
🏗️ 메인 그리드 → 20개씩 카드 배치 (드래그앤드롭)
📋 INI 모달 → 전체/필터/선택 대상에 INI 전송
```

### 📜 dashboard.js 핵심 함수
```javascript
// 📡 데이터 관리
fetchClients()           # 5초마다 /api/clients 호출
applyFilters()           # 검색/필터 적용

// 🎴 카드 관리
updateCards()            # 카드 생성/업데이트
toggleCardByCheckbox()   # 개별 카드 선택
toggleRowSelection()     # 줄 단위 선택

// 📤 INI 전송 ⭐ NEW
sendIniCommand()         # INI 명령 전송
loadTemplate()           # 템플릿 로드
addLog()                 # 전송 로그 표시
```

### 🎯 Flask API 엔드포인트
```python
# 기존 API
GET /                    # 메인 대시보드 렌더링
GET /api/clients         # 클라이언트 상태 JSON
GET /dia-history         # 다이아 히스토리 페이지
GET /api/dia-history     # 히스토리 데이터 JSON

# 새로 추가된 API ⭐
POST /api/send-ini       # INI 명령 전송
```

---

## 🔧 INI 전송 시스템 (신규 구현)

### 📤 전송 과정
1. **웹에서 선택**: 전체/필터/선택된 클라이언트
2. **INI 작성**: 템플릿 또는 직접 작성
3. **Flask 전송**: `/api/send-ini` POST 요청
4. **DB 기록**: `ini_commands` 테이블에 저장
5. **실제 전송**: `server_send.py`가 각 클라이언트에 HTTP 요청
6. **상태 업데이트**: 성공/실패 상태 DB 업데이트
7. **로그 표시**: 실시간 전송 결과 웹에 표시

### 📄 INI 메시지 형식
```json
{
    "source": "command",
    "type": "ini_file",
    "filename": "192.168.1.100_2025-01-14_15-30.ini",
    "content": "[Commands]\naction=START\ntarget=VM_Flow_LoY.exe",
    "save_path": "C:\\Users\\Administrator\\Desktop\\VM_Flow_Odin\\"
}
```

---

## 🎮 클라이언트 구성

### 📄 client/config.json
```json
{
    "server": {
        "ip": "172.30.101.232",
        "send_port": 5050,         # server.py 포트
        "recv_port": 6000,         # 명령 수신용 (미사용)
        "http_port": 8123          # 웹서버용 (미사용)
    },
    "targets": ["VM_Flow_LoY.exe", "VM_Flow_NC.exe"],
    "sensitive_commands": ["RESTART", "SHUTDOWN", "EXIT", "KILL"]
}
```

### 💻 client.py 동작
1. **주기적 상태 보고** (58초마다)
2. **게임 프로세스 모니터링**
3. **다이아 수량 추출**
4. **server.py로 JSON 전송**

---

## 🚀 주요 변경사항 (최신)

### ✅ 완료된 기능
1. **INI 명령 전송 UI**: 모달창, 템플릿, 로그
2. **클라이언트 선택**: 체크박스, 줄 단위 선택
3. **Flask API**: `/api/send-ini` 엔드포인트
4. **DB 이력 저장**: `ini_commands` 테이블
5. **실시간 로그**: 전송 상태 표시

### 🔄 현재 통신 방식
- **상태 모니터링**: TCP 소켓 (JSON)
- **INI 전송**: HTTP 요청 (JSON 페이로드)
- **웹 인터페이스**: AJAX (JSON API)

---

## 🎯 핵심 포트 구성

| 구성 요소 | 포트 | 프로토콜 | 용도 |
|----------|------|----------|------|
| server.py | 5050 | TCP | 클라이언트 상태 수신 + INI 명령 수신 |
| Flask (app.py) | 8000 | HTTP | 웹 대시보드 서버 |
| client.py → server | 5050 | TCP | 상태 보고 전송 |
| INI 전송 → client | 5050 | HTTP | INI 명령 전송 |

---

## 📝 사용 시나리오

### 🔍 모니터링 시나리오
1. 게임PC에서 `client.py` 실행
2. 웹에서 `http://서버IP:8000` 접속
3. 실시간 카드보드에서 상태 확인
4. 검색/필터로 원하는 클라이언트 찾기

### 📤 명령 전송 시나리오
1. 웹 대시보드에서 "INI 명령 전송" 버튼 클릭
2. 대상 선택 (전체/필터/선택)
3. 템플릿 선택 또는 직접 INI 작성
4. 전송 버튼 클릭
5. 실시간 로그로 결과 확인
6. 각 게임PC에 INI 파일 자동 생성

---

## 🔍 파일별 핵심 역할

### 🖥️ 서버 사이드
- **`server.py`**: TCP 서버, 상태 수신, 배치 처리, DB 저장
- **`app.py`**: Flask 웹서버, REST API, 대시보드 렌더링
- **`server_send.py`**: INI 명령 전송 모듈

### 🌐 클라이언트 사이드
- **`dashboard.html`**: UI 레이아웃, 모달, 카드 구조
- **`dashboard.js`**: AJAX 통신, 카드 관리, INI 전송 로직

### 💻 게임PC 사이드
- **`client.py`**: 게임 모니터링, 상태 보고, 프로세스 감시

---

## 🎊 시스템 특징

### ✨ 장점
- **실시간 모니터링**: 5초마다 자동 갱신
- **직관적 UI**: 카드보드 방식, 드래그앤드롭
- **유연한 명령**: INI 템플릿 + 직접 작성
- **완전한 로그**: 전송 이력 DB 저장
- **다중 대상**: 전체/필터/선택 방식

### 🔧 기술 스택
- **Backend**: Python + Flask + SQLite
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **통신**: TCP Socket + HTTP + AJAX
- **UI**: Bootstrap 없이 순수 CSS

---

## 🔧 현재 구현 상태 요약

### ✅ **완전 동작**
- 클라이언트 상태 모니터링
- 웹 대시보드 (카드보드)
- 다이아 히스토리 차트
- INI 명령 전송 시스템
- 실시간 로그 표시

### 🎯 **핵심 흐름**
```
게임PC → server.py → SQLite ← Flask ← 웹브라우저
                                 ↓
                           server_send.py
                                 ↓
                             게임PC (INI 파일 생성)
```

이 시스템은 현재 **완전히 동작하는 상태**이며, 게임 클라이언트 관리와 원격 명령 전송이 모두 구현되어 있습니다.