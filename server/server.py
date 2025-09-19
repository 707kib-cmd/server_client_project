# ========================================
# 💻 다이아/오토핫키 상태 수신 서버
# 📦 파일명: server.py
# 📅 버전: v1.5.0 (2025-06-30)
# 👨‍💻 개선사항:
#   - 클라이언트에게 AHK 메시지 전송 기능 추가
#   - 수신/송신 로그 정제 및 오류 로깅 강화
# ========================================

import sys, socket, threading, json, datetime, time
import os, traceback
import sqlite3
import queue
from threading import local

# 실행 위치 기준 디렉터리 (EXE 대응 포함)
BASE_DIR = os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else os.path.abspath(__file__))
data_queue = queue.Queue() # 배치 처리용 큐
DB_PATH = os.path.join(BASE_DIR, "client_status.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS clients (
    name TEXT PRIMARY KEY,
    ip TEXT,
    game TEXT,
    server TEXT,
    dia INTEGER,
    last_report TEXT,
    status TEXT,
    message TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_dia (
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    ip TEXT,
    game TEXT,
    server TEXT,
    dia INTEGER,
    status TEXT,
    message TEXT,
    PRIMARY KEY (date, name)
)
""")

conn.commit()

# 기본 설정값
DEFAULT_CONFIG = {
    "server_ip": "0.0.0.0",
    "server_port": 5050,
    "log_path": os.path.join(BASE_DIR, "server_log.txt"),
    "debug_log_path": os.path.join(BASE_DIR, "client_debug.log"),
    "report_interval_sec": 58
}

# 현재 시각 문자열 반환
def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 여기에 새 함수들 추가
thread_local = local()

def get_db_connection():
    if not hasattr(thread_local, 'connection'):
        thread_local.connection = sqlite3.connect(
            DB_PATH,
            timeout=30.0,
            check_same_thread=False
        )
        thread_local.connection.execute("PRAGMA journal_mode=WAL")
    return thread_local.connection

# 설정 불러오기
def load_config():
    try:
        with open(os.path.join(BASE_DIR, "settings.json"), "r", encoding="utf-8") as f:
            user = json.load(f)
            return {**DEFAULT_CONFIG, **user}
    except:
        return DEFAULT_CONFIG

# 로그 출력 함수
def log(msg, file):
    text = f"[{now()}] {msg}"
    print(text)
    try:
        with open(file, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    except:
        pass  # 로그 파일 접근 문제 있을 시 무시

# AHK 생존 기록 저장소
ahk_map = {}  # {name: last_report_time}
ahk_lock = threading.Lock()

# 감시 루프: 일정 시간 이상 수신 없으면 경고 출력
def watch_ahk(alert_sec, log_path):
    while True:
        now_ts = time.time()
        with ahk_lock:
            for name, last in list(ahk_map.items()):
                if now_ts - last > alert_sec:
                    mins = int((now_ts - last) // 60)
                    log(f"❗AHK 수신 중단 → {name} ({mins}분 이상)", log_path)
        time.sleep(60)

# 클라이언트에 TCP로 메시지 전송 (→ 클라가 AHK 실행)
def send_to_client(client_ip, message, log_path):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((client_ip, 6000))
            sock.sendall(message.encode("utf-8"))
        log(f"📤 클라로 명령 전송 → {client_ip} | 내용: {message}", log_path)
    except Exception as e:
        log(f"⚠️ 클라 전송 실패 → {client_ip} | 오류: {e}", log_path)


def store_client_batch(payload):
    """클라이언트 데이터를 큐에 추가 (빠른 처리)"""
    data_queue.put(payload)

def batch_insert_to_db(batch_data):
    """배치 데이터를 DB에 한번에 저장"""
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 배치로 clients 테이블 저장
        clients_data = []
        daily_data = []

        for payload in batch_data:
            clients_data.append((
                payload.get("name", "unknown"),
                payload.get("ip", "?"),
                payload.get("game", "?"),
                payload.get("game_server", "?"),
                int(payload.get("dia", 0)),
                now(),
                "alive",
                payload.get("msg", "?")
            ))

            daily_data.append((
                today,
                payload.get("name", "unknown"),
                payload.get("ip", "?"),
                payload.get("game", "?"),
                payload.get("game_server", "?"),
                int(payload.get("dia", 0)),
                "alive",
                payload.get("msg", "?")
            ))

        # 배치 INSERT
        cursor.executemany("""
        INSERT OR REPLACE INTO clients
        (name, ip, game, server, dia, last_report, status, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, clients_data)

        cursor.executemany("""
        INSERT OR REPLACE INTO daily_dia
        (date, name, ip, game, server, dia, status, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, daily_data)

        conn.commit()
        print(f"배치 DB 저장 성공: {len(batch_data)}개 항목")
    except Exception as e:
        print(f"배치 DB 저장 실패: {e}")

def batch_processor():
    """백그라운드에서 주기적으로 배치 저장"""
    while True:
        batch_data = []
        try:
            # 5초간 또는 100개까지 데이터 수집
            end_time = time.time() + 5
            while time.time() < end_time and len(batch_data) < 100:
                try:
                    data = data_queue.get(timeout=1)
                    batch_data.append(data)
                except queue.Empty:
                    break

            if batch_data:
                batch_insert_to_db(batch_data)

        except Exception as e:
            print(f"배치 처리 오류: {e}")

# 수신 처리 함수
def handle_client(conn, addr, log_path):
    try:
        raw = conn.recv(2048)
        if not raw:
            log(f"⚠️ 수신 실패: 빈 데이터 (IP: {addr[0]})", log_path)
            return

        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception as e:
            log(f"⚠️ JSON 파싱 실패: {e}", log_path)
            return

        # 🔹 클라이언트에서 보내온 필드들 파싱
        ip          = payload.get("ip", addr[0])
        name        = payload.get("name", "unknown")
        game        = payload.get("game", "?")
        game_server = payload.get("game_server", "?")
        dia         = payload.get("dia", "?")
        msg         = payload.get("msg", "?")

        # 🔹 생존 갱신
        with ahk_lock:
            ahk_map[name] = time.time()

        store_client_batch(payload)  # 👈 이 한 줄로 DB에 기록됨!

        # 🔸 예쁘게 출력
        log_line = f"수신 → {ip} | {name} | {game_server} | 게임: {game} | 다이아: {dia} | 메시지: {msg}"
        log(log_line, log_path)

    except Exception as e:
        log(f"⚠️ 수신 처리 실패: {e}\n{traceback.format_exc()}", log_path)
    finally:
        conn.close()

# 서버 메인 루프
def start_server():
    config = load_config()
    host = config["server_ip"]
    port = config["server_port"]
    log_path = config["log_path"]
    alert_sec = config.get("report_interval_sec", 58) * 2

    log(f"✅ 서버 포트 {port} 수신 대기 중...", log_path)

    threading.Thread(target=watch_ahk, args=(alert_sec, log_path), daemon=True).start()
    threading.Thread(target=batch_processor, daemon=True).start()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((host, port)) #포크 커널에 점유 중복실행 방지
        s.listen(5)
    except Exception as e:
        log(f"⚠️ 서버 바인딩 실패: {e}", log_path)
        return

    while True:
        try:
            conn, addr = s.accept()
            threading.Thread(target=handle_client, args=(conn, addr, log_path), daemon=True).start()
        except Exception as e:
            log(f"⚠️ 클라이언트 수신 오류: {e}", log_path)

# 시작 포인트
if __name__ == "__main__":
    start_server()