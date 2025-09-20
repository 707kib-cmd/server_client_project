# 💻 클라이언트 분석 (CLIENT ANALYSIS)

## 📋 개요
`client.py` - 게임 프로세스 모니터링 + 서버 양방향 통신 (v2.3.6-stealth)

---

## 🔧 핵심 함수

### 1. **설정 및 초기화**
```python
load_config()              # config.json 로드 (필수, 없으면 종료)
is_target_running()        # VM_Flow_LoY.exe, VM_Flow_NC.exe 실행 확인
get_running_target()       # 프로세스명 → 별칭 (LoY, NC)
save_version_file()        # VERSION.txt 저장
```

### 2. **서버 통신**
```python
send_to_server(server_ip, report_ip, name, diamond, mode, game, msg, game_server)
# JSON 페이로드를 서버 포트 5050으로 전송 (타임아웃 3초)
```

### 3. **명령 수신 (CommandReceiver 스레드)**
```python
# 포트 6000에서 서버 명령 수신
# 스텔스 모드: 대상 프로세스 실행 중일 때만 처리
# 수신한 명령을 MessageCache.ini에 저장
```

### 4. **HTTP 수신 (HttpReceiver 스레드)**
```python
# 포트 8123에서 AutoHotkey HTTP GET 요청 처리
# URL: http://localhost:8123/send?dia=1000&name=client1&ip=...
# 파라미터 파싱 → send_to_server() 호출
```

### 5. **INI 파일 관리**
```python
save_command_to_ini(command_msg)    # 명령을 INI 파일로 저장
clear_ini_after_sensitive(msg)      # 민감명령 처리 후 INI 초기화
```

### 6. **로그 관리**
```python
log(msg)                     # 콘솔 + 파일 로깅
manage_debug_log(config)     # 로그 크기/날짜 자동 관리
rotate_log(path)             # 로그 회전 (.1, .2 백업)
trim_message_cache()         # 메시지 캐시 줄 수 제한
```

---

## 🛡️ 스텔스 모드 기능

### 대상 프로세스 감시
```python
targets = ["VM_Flow_LoY.exe", "VM_Flow_NC.exe"]
target_alias = {
    "VM_Flow_LoY.exe": "LoY",
    "VM_Flow_NC.exe": "NC"
}
```

### 스텔스 동작
- 대상 프로세스가 없으면 명령 무시
- 중복 실행 방지 (Mutex: `Global\\MY_CLIENT_MUTEX_LOCK`)
- 민감 명령어는 즉시 INI 초기화 (`RESTART`, `SHUTDOWN` 등)

---

## 🌐 포트 구성

| 포트 | 방향 | 용도 |
|------|------|------|
| 5050 | → 서버 | 상태 데이터 전송 |
| 6000 | ← 서버 | 명령 수신 |
| 8123 | ← AHK | HTTP 요청 수신 |

---

## 🔄 데이터 흐름

### AutoHotkey → 서버
```
AHK Script → HTTP :8123 → HttpReceiver → send_to_server() → TCP :5050 → Server
```

### 서버 → AutoHotkey
```
Server → TCP :6000 → CommandReceiver → save_command_to_ini() → INI File → AHK Script
```

---

## ⚙️ 주요 설정 (config.json)

```json
{
  "server": {
    "ip": "172.30.101.232",
    "send_port": 54321,        # ⚠️ 불일치 (실제는 5050)
    "recv_port": 6000,
    "http_port": 8123
  },
  "targets": ["VM_Flow_LoY.exe", "VM_Flow_NC.exe"],
  "sensitive_commands": ["RESTART", "SHUTDOWN", "EXIT", "KILL"],
  "client": {
    "message_cache_max_lines": 1000,
    "log_max_size_mb": 5,
    "log_max_age_days": 7
  }
}
```

---

## ⚠️ 주요 문제점

### 1. 포트 설정 불일치
```
config.json: send_port = 54321
실제 서버: port = 5050
```

### 2. 하드코딩된 설정값
- `SEND_PORT = config["server"]["send_port"]` (잘못된 포트 사용)
- IP 주소가 여러 곳에 분산

### 3. 오류 처리 부족
- 네트워크 단절 시 재연결 로직 없음
- HTTP 요청 파싱 오류 처리 미흡

---

## 🚀 개선 제안

### 긴급 수정
```python
# 1. 포트 통일
"send_port": 5050  # config.json 수정

# 2. 재연결 로직
def send_to_server_with_retry(max_retries=3):
    for i in range(max_retries):
        try:
            send_to_server(...)
            return True
        except Exception as e:
            if i == max_retries - 1:
                log(f"최종 전송 실패: {e}")
            time.sleep(2 ** i)  # 지수 백오프
    return False
```

### 보안 강화
- 민감정보 암호화, SSL/TLS 적용
- 명령어 화이트리스트 활용

### 성능 최적화
- 비동기 처리, 연결 풀링

---
**📅 분석일**: 2025-01-14 | **버전**: v2.3.6-stealth