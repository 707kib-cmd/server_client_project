import psutil
import time
import os

# 🔧 모니터링할 프로세스 이름 리스트
TARGET_PROCESSES = ["client.exe", "img_ocr.exe", "python.exe"]  # 원하는 이름 추가

# 🔁 모니터링 주기 (초 단위)
INTERVAL = 2

def print_thread_info(proc):
    try:
        threads = proc.threads()
        process_name = proc.name()
        pid = proc.pid

        # ▶ 실행된 .py 파일 추적 (Command Line 기준)
        cmdline_list = proc.cmdline()
        if len(cmdline_list) >= 2:
            executed_file = cmdline_list[1]  # python.exe 다음 인자 → 실행된 py 파일
        else:
            executed_file = "정보 없음"

        print(f"\n📦 PID: {pid} | Name: {process_name} | Threads: {len(threads)}")
        print(f"   ▶ 실행파일: {executed_file}")

        for idx, t in enumerate(threads, 1):
            tid = t.id
            cpu_time = t.user_time + t.system_time
            print(f"  🧵 [{idx}] Thread ID: {tid} | CPU Time: {cpu_time:.3f}s | Program: {process_name} (PID: {pid})")
    except (psutil.NoSuchProcess, psutil.AccessDenied, IndexError):
        pass

def monitor_threads():
    os.system("cls" if os.name == "nt" else "clear")
    print("🧠 실시간 스레드 & 실행파일 모니터링 시작...\n")
    while True:
        found = False
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            if proc.info['name'] in TARGET_PROCESSES:
                found = True
                print_thread_info(proc)
        if not found:
            print("⚠️ 대상 프로세스가 실행 중이 아닙니다.")
        print("\n" + "-" * 60)
        time.sleep(INTERVAL)

if __name__ == "__main__":
    monitor_threads()