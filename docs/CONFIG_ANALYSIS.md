# ⚙️ 설정 분석 (CONFIG ANALYSIS)

## 📋 개요
프로젝트의 모든 설정 파일 상세 분석 및 문제점 진단

---

## 📄 client/config.json

### 서버 연결 설정
```json
{
  "server": {
    "ip": "172.30.101.232",
    "send_port": 54321,        # ⚠️ 실제 서버는 5050 사용
    "recv_port": 6000,         # ✅ 정상
    "http_port": 8123          # ✅ 정상
  }
}
```

### 클라이언트 설정
```json
{
  "client": {
    "log_file": "client_debug.log",
    "msg_file": "MessageCache.txt",
    "ini_file": "MessageCache.ini",
    "mutex_name": "Global\\MY_CLIENT_MUTEX_LOCK",
    "message_cache_max_lines": 1000,    # 메시지 캐시 최대 줄 수
    "log_max_size_mb": 5,               # 로그 파일 최대 크기 (MB)
    "log_max_age_days": 7               # 로그 파일 최대 보존 기간
  }
}
```

### 대상 프로세스 설정
```json
{
  "targets": ["VM_Flow_LoY.exe", "VM_Flow_NC.exe"],
  "target_alias": {
    "VM_Flow_LoY.exe": "LoY",
    "VM_Flow_NC.exe": "NC"
  }
}
```

### 보안 설정
```json
{
  "sensitive_commands": ["RESTART", "SHUTDOWN", "EXIT", "KILL"],
  "command_whitelist": ["START", "STOP", "SYNC", "REBOOT", "DIAMOND"]  # 사용안함
}
```

---

## 📄 server/settings.json

### 네트워크 설정
```json
{
  "server_ip": "172.30.101.232",      # 바인딩 IP (0.0.0.0 권장)
  "server_port": 54321,               # ⚠️ 실제 코드는 5050 사용
  "client_listen_port": 8123,         # 사용안함
  "report_interval_sec": 58           # 클라이언트 생존 체크 간격
}
```

### 로그 설정
```json
{
  "log_path": "server_log.txt",
  "debug_log_path": "client_debug.log"  # 사용안함
}
```

---

## ⚠️ 설정 문제점 분석

### 1. **포트 설정 불일치** (심각)
| 구분 | 설정값 | 실제값 | 문제 |
|------|--------|--------|------|
| client → server | 54321 | 5050 | 연결 실패 가능성 |
| server 바인딩 | 54321 | 5050 | DEFAULT_CONFIG 우선 |

### 2. **사용되지 않는 설정**
```json
// client/config.json
"command_whitelist": [...],           # 코드에서 미사용

// server/settings.json
"client_listen_port": 8123,           # 사용 안함
"debug_log_path": "client_debug.log"  # 사용 안함
```

### 3. **하드코딩 vs 설정 충돌**
```python
# server.py
DEFAULT_CONFIG = {
    "server_port": 5050        # 실제 사용값
}

# settings.json
"server_port": 54321          # 무시됨
```

---

## 🔧 설정 우선순위 분석

### server.py 로딩 순서
```python
def load_config():
    config = {**DEFAULT_CONFIG}    # 1. 기본값
    try:
        user_config = json.load(f)
        config.update(user_config) # 2. settings.json 덮어씀
    except:
        return DEFAULT_CONFIG      # 3. 파일 없으면 기본값만
```

### client.py 로딩 (강제)
```python
def load_config():
    try:
        return json.load(f)        # config.json 필수
    except:
        sys.exit(1)               # 없으면 종료
```

---

## 💡 권장 설정값

### 수정된 client/config.json
```json
{
  "server": {
    "ip": "172.30.101.232",
    "send_port": 5050,           # ← 5050으로 통일
    "recv_port": 6000,
    "http_port": 8123
  },
  "client": {
    "log_file": "client_debug.log",
    "msg_file": "MessageCache.txt",
    "ini_file": "MessageCache.ini",
    "mutex_name": "Global\\CLIENT_MUTEX",
    "message_cache_max_lines": 1000,
    "log_max_size_mb": 10,       # 크기 증가
    "log_max_age_days": 30       # 보존 기간 연장
  },
  "targets": ["VM_Flow_LoY.exe", "VM_Flow_NC.exe"],
  "target_alias": {
    "VM_Flow_LoY.exe": "LoY",
    "VM_Flow_NC.exe": "NC"
  },
  "sensitive_commands": ["RESTART", "SHUTDOWN", "EXIT", "KILL", "REBOOT"],
  "report": {
    "interval_sec": 58,
    "enabled": true,
    "retry_count": 3,            # 신규 추가
    "timeout_sec": 5             # 신규 추가
  }
}
```

### 수정된 server/settings.json
```json
{
  "server_ip": "0.0.0.0",        # 모든 인터페이스 바인딩
  "server_port": 5050,           # ← 5050으로 통일
  "log_path": "server_log.txt",
  "report_interval_sec": 58,
  "max_connections": 100,        # 신규: 최대 연결수
  "log_level": "INFO",           # 신규: 로그 레벨
  "backup_interval_hours": 24    # 신규: DB 백업 간격
}
```

---

## 🔍 설정 검증 스크립트

```python
def validate_config():
    """설정 파일 검증"""
    errors = []

    # 1. 포트 일치 검사
    client_port = client_config["server"]["send_port"]
    server_port = server_config["server_port"]
    if client_port != server_port:
        errors.append(f"포트 불일치: client({client_port}) vs server({server_port})")

    # 2. 필수 필드 검사
    required_fields = ["server.ip", "targets", "sensitive_commands"]
    for field in required_fields:
        if not get_nested_value(client_config, field):
            errors.append(f"필수 설정 누락: {field}")

    # 3. 네트워크 연결 검사
    try:
        socket.create_connection((server_ip, server_port), timeout=3)
    except:
        errors.append(f"서버 연결 실패: {server_ip}:{server_port}")

    return errors

# 실행
if __name__ == "__main__":
    errors = validate_config()
    if errors:
        print("❌ 설정 오류 발견:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("✅ 모든 설정이 정상입니다.")
```

---

## 🔄 환경별 설정 관리 제안

### 개발/운영 환경 분리
```python
# config_manager.py
import os
import json

class ConfigManager:
    def __init__(self, env="production"):
        self.env = env
        self.config = self.load_config()

    def load_config(self):
        base_config = self.load_json("config.json")
        env_config = self.load_json(f"config.{self.env}.json")
        return {**base_config, **env_config}

    def get(self, key, default=None):
        keys = key.split(".")
        value = self.config
        for k in keys:
            value = value.get(k, {})
        return value if value != {} else default

# 사용법
config = ConfigManager(env=os.getenv("ENV", "production"))
server_port = config.get("server.port", 5050)
```

### 설정 파일 구조 제안
```
config/
├── config.json              # 공통 설정
├── config.development.json  # 개발환경
├── config.production.json   # 운영환경
└── config.test.json         # 테스트환경
```

---

## 🚀 즉시 적용 가능한 수정사항

### 1. 포트 통일 (최우선)
```bash
# client/config.json 수정
sed -i 's/"send_port": 54321/"send_port": 5050/' client/config.json

# server/settings.json 수정
sed -i 's/"server_port": 54321/"server_port": 5050/' server/settings.json
```

### 2. 불필요한 설정 제거
```json
// 제거할 항목들
"command_whitelist": [...],      # client/config.json
"client_listen_port": 8123,     # server/settings.json
"debug_log_path": "..."         # server/settings.json
```

### 3. 보안 강화
```json
// 추가 권장 설정
"network": {
    "ssl_enabled": false,        # 향후 HTTPS 적용
    "allowed_ips": ["127.0.0.1", "172.30.101.0/24"]
},
"security": {
    "api_key": "your_secret_key",
    "rate_limit": 100            # 분당 요청 제한
}
```

---

**📅 분석일**: 2025-01-14 | **우선순위**: 포트 통일 필수