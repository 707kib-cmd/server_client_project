# =============================================
# client.py
# ✅ v2.3.2-stealth – 대상 실행 조건 기반 스텔스 모드
# =============================================

import sys, socket, threading, subprocess, datetime, os
import http.server, urllib.parse, json, ctypes
import configparser
import psutil
import json

print("🛠️ 현재 작업 디렉토리:", os.getcwd())

# 🗂️ 실행 경로 설정
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PARENT_DIR = os.path.dirname(BASE_DIR)
# ✅ 실행 디렉토리를 BASE_DIR로 강제 고정!
os.chdir(BASE_DIR)

# 📦 설정 파일 로딩
def load_config():
    path = os.path.join(BASE_DIR, "config.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ config.json 로딩 실패: {e}")
        sys.exit(1)  # 바로 종료 (없으면 정상 작동 안 함)

config = load_config()

SERVER_IP = config["server"]["ip"]
SEND_PORT = config["server"]["send_port"]
CMD_RECV_PORT = config["server"]["recv_port"]
LOCAL_HTTP_PORT = config["server"]["http_port"]

LOG_FILE = config["client"]["log_file"]
MSG_FILE = config["client"]["msg_file"]
INI_FILE = config["client"]["ini_file"]

SENSITIVE_COMMANDS = config["sensitive_commands"]

def is_target_running():
    targets = config["targets"]
    for proc in psutil.process_iter(['name']):
        if proc.info['name'] in targets:
            return True
    return False

# 🔰 버전 정보
VERSION = "v2.3.2-stealth"
def save_version_file():
    try:
        with open("VERSION.txt", "w", encoding="utf-8") as f:
            f.write(VERSION)
            log(f"📄 VERSION.txt 저장 완료 → VERSION = {VERSION}")  # ✅ 이 줄 추가!
    except Exception as e:
        log(f"❌ VERSION.txt 저장 실패: {e}")

# 📄 경로 기반 파일 지정
AHK_EXEC   = os.path.join(PARENT_DIR, "VM_Flow_NC.exe")

# 🛡️ 중복 실행 방지 (Mutex)
mutexname = config["client"]["mutex_name"]
mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutexname)
if ctypes.windll.kernel32.GetLastError() == 183:
    print("❌ 이미 실행 중 - client.exe 중복 차단됨")
    sys.exit(0)

# 🎯 현재 실행 중인 대상 이름 반환
def get_running_target():
        aliases = config["target_alias"]
        for proc in psutil.process_iter(['name']):
            if proc.info['name'] in aliases:
                return aliases[proc.info['name']]
        return "NONE"

# 🕒 현재 시각 포맷팅
def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 📝 로그 함수
def log(msg):
    text = f"[{now()}] {msg}"
    print(text)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    except Exception as e:
        print(f"[⚠️ 로그 저장 실패] {e}")

# 🧾 INI 저장
def save_command_to_ini(command_msg):
    ini = configparser.ConfigParser()
    ini["Command"] = {
        "Last": command_msg,
        "Timestamp": now(),
        "Executed": "False",
        "Target": get_running_target()
    }
    try:
        with open(INI_FILE, "w", encoding="utf-16") as f:
            ini.write(f)
        log(f"📄 INI 저장 완료 → {INI_FILE} | 명령: {command_msg}")
    except Exception as e:
        log(f"❌ INI 저장 실패: {e}")

# 💎 민감 명령 처리 시 초기화
def clear_ini_after_sensitive(msg):
    if msg in SENSITIVE_COMMANDS:
        ini = configparser.ConfigParser()
        ini["Command"] = {
            "Last": "",
            "Timestamp": now(),
            "Executed": "True"
        }
        try:
            with open(INI_FILE, "w", encoding="utf-8") as f:
                ini.write(f)
            log(f"🧹 민감 명령 처리 후 ini 초기화 완료")
        except Exception as e:
            log(f"❌ INI 클리어 실패: {e}")

# 📤 서버 전송 함수
def send_to_server(server_ip, report_ip, name, diamond, mode="send"):
    payload = {"name": name, "ip": report_ip, "value": f"{diamond} | {mode}"}
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3)
        s.connect((server_ip, SEND_PORT))
        s.sendall(json.dumps(payload).encode("utf-8"))
        s.close()
        log(f"✅ 서버 전송 완료 → {server_ip}:{SEND_PORT} | {payload}")
    except Exception as e:
        log(f"❌ 서버 전송 실패: {e}")

# 🛰️ 명령 수신 스레드
class CommandReceiver(threading.Thread):
    def run(self):
        try:
            log(f"[RECV] 서버 명령 대기 중... (port {CMD_RECV_PORT})")
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('0.0.0.0', CMD_RECV_PORT))
            s.listen(1)
            while True:
                conn, addr = s.accept()
                try:
                    data = conn.recv(1024).decode("utf-8").strip()
                    if data:
                        log(f"[RECV] 명령 수신 ← {addr[0]}: {data}")
                        if not is_target_running():
                            log("🥷 대상 실행 안 됨 — 명령 무시 (스텔스 모드)")
                            continue

                        if data not in SENSITIVE_COMMANDS:
                            with open(MSG_FILE, "w", encoding="utf-8") as f:
                                f.write(data)
                            log(f"📦 메시지 저장 완료 → {MSG_FILE}")

                        save_command_to_ini(data)
                        clear_ini_after_sensitive(data)
                except Exception as e:
                    log(f"❌ 명령 수신 오류: {e}")
                finally:
                    conn.close()
        except Exception as e:
            log(f"❌ CommandReceiver 예외: {e}")
            print(f"❌ CommandReceiver 예외: {e}")

# 🌐 HTTP 요청 수신 핸들러
class SendHttpHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/send":
            params = urllib.parse.parse_qs(parsed.query)
            dia  = params.get("dia",  [""])[0]
            name = params.get("name", [""])[0]
            ip   = params.get("ip",   [""])[0]
            mode = params.get("mode", ["send"])[0]
            if all([dia, name, ip]):
                log(f"[HTTP] 전송 요청 수신: {dia}, {mode}, {name}, {ip}")
                send_to_server(SERVER_IP, ip, name, dia, mode)
                response = b"OK"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(response)))
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(response)
                self.wfile.flush()
                return
        error = b"Bad Request"
        self.send_response(400)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(error)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(error)
        self.wfile.flush()

# 🌐 HTTP 수신 스레드
class HttpReceiver(threading.Thread):
    def run(self):
        try:
            log(f"[HTTP] AHK 전송 요청 대기 중... (port {LOCAL_HTTP_PORT})")
            server = http.server.HTTPServer(("localhost", LOCAL_HTTP_PORT), SendHttpHandler)
            server.serve_forever()
        except Exception as e:
            log(f"❌ HttpReceiver 예외: {e}")
            print(f"❌ HttpReceiver 예외: {e}")

# 🏁 메인 실행
def main():
    save_version_file()  # 🧾 실행 시 버전 텍스트 저장
    log(f"🚀 client.exe 시작됨 ({VERSION})")
    try:
        t1 = CommandReceiver()
        t2 = HttpReceiver()
        t1.daemon = True
        t2.daemon = True
        t1.start()
        t2.start()
    except Exception as e:
        log(f"❌ 스레드 실행 오류: {e}")
        print(f"❌ 스레드 실행 오류: {e}")

    try:
        while True:
            pass
    except KeyboardInterrupt:
        log("🔻 종료 요청 수신")

if __name__ == "__main__":
    main()