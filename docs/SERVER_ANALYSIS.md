# 🖥️ 서버 분석 (SERVER ANALYSIS)

## 📋 개요
`server.py` - TCP 서버 (포트 5050), 클라이언트 상태 데이터 수집 및 SQLite 저장

---

## 🔧 핵심 함수

### 1. **설정 및 초기화**
```python
load_config()           # settings.json + 기본설정 병합
now()                   # 현재 시간 "YYYY-MM-DD HH:MM:SS"
log(msg, file)          # 콘솔 + 파일 동시 로깅
```

### 2. **클라이언트 처리**
```python
handle_client(conn, addr, log_path)    # 각 클라이언트 연결 처리 (멀티스레드)
store_client(payload)                  # SQLite INSERT OR REPLACE
```
**수신 데이터**: `{"name": "NC-테오필-01", "ip": "192.168.1.100", "dia": 50000, ...}`

### 3. **생존 감시**
```python
watch_ahk(alert_sec, log_path)         # 백그라운드 스레드, 60초마다 체크
ahk_map = {}                           # {클라이언트명: 마지막수신시간}
ahk_lock = threading.Lock()            # 동시성 제어
```

### 4. **명령 전송**
```python
send_to_client(client_ip, message, log_path)  # TCP 포트 6000으로 명령 전송
```

### 5. **서버 메인**
```python
start_server()          # TCP 소켓 바인딩, 멀티스레드 accept 루프
```

---

## 🗃️ 데이터베이스

### clients 테이블
```sql
CREATE TABLE clients (
    name TEXT PRIMARY KEY,     -- 클라이언트 식별자
    ip TEXT, game TEXT, server TEXT,
    dia INTEGER,               -- 다이아 수량
    last_report TEXT,          -- 마지막 보고시간
    status TEXT, message TEXT
);
```

---

## 🧵 스레드 구조

- **메인**: TCP accept 루프
- **생존감시**: 60초마다 클라이언트 체크 (`daemon=True`)
- **클라이언트처리**: 연결당 1개 스레드 (`daemon=True`)

---

## ⚠️ 주요 문제점

### 1. 포트 설정 불일치
```
실제 사용: 5050 (DEFAULT_CONFIG)
설정파일: 54321 (settings.json) ← 무시됨
```

### 2. 예외 처리 부족
- TCP 타임아웃 없음
- JSON 파싱 오류 처리 미흡
- 데이터 검증 없음

### 3. 성능 이슈
- DB 연결을 매번 생성 (연결풀링 필요)
- 실시간 INSERT (배치 처리 고려)

---

## 🚀 개선 제안

### 긴급 수정
```python
# 1. 포트 통일
DEFAULT_CONFIG["server_port"] = 5050  # settings.json도 5050으로

# 2. 타임아웃 추가
conn.settimeout(10.0)

# 3. 데이터 검증
required_fields = ['name', 'ip', 'dia']
for field in required_fields:
    if field not in payload:
        raise ValueError(f"필수 필드 누락: {field}")
```

### 성능 최적화
- 연결 풀링, 배치 처리, 인덱스 추가

### 보안 강화
- SSL/TLS, 입력 검증, 로그 레벨 구분

---
**📅 분석일**: 2025-01-14 | **버전**: v1.5.0