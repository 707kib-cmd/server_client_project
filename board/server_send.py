import socket
import json
import sqlite3
import datetime
import os

# DB 경로 설정 (app.py와 동일한 경로)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '..', 'server', 'client_status.db')


def send_ini_command(client_ip, filename, content):
    try:
        print(f"INI 전송 시작: {client_ip} -> {filename}")

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5.0)
        sock.connect((client_ip, 5050))

        # INI 파일 정보 포함한 메시지
        message = json.dumps({
            "source": "command",
            "type": "ini_file",
            "filename": filename,
            "content": content,
            "save_path": "C:\\Users\\Administrator\\Desktop\\VM_Flow_Odin\\ini_commands\\"
        })

        http_request = f"POST / HTTP/1.1\r\nContent-Length: {len(message)}\r\n\r\n{message}"

        sock.send(http_request.encode())
        print("메시지 전송 완료, 응답 대기 중...")

        response = sock.recv(1024).decode()
        sock.close()

        print(f"클라이언트 응답: {response}")

        # DB 상태 업데이트
        if "OK" in response:
            update_ini_command_status(filename, "SUCCESS", "INI 파일 생성 완료")
            return f"SUCCESS: {response}"
        else:
            update_ini_command_status(filename, "FAILED", response)
            return f"ERROR: {response}"

    except Exception as e:
        print(f"INI 전송 오류: {e}")
        update_ini_command_status(filename, "FAILED", str(e))
        return f"ERROR: {str(e)}"


def update_ini_command_status(filename, status, result):
    """DB에서 INI 명령 상태 업데이트"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE ini_commands 
                SET execution_status=?, execution_timestamp=?, execution_result=?
                WHERE filename=?
            ''', (status, datetime.datetime.now(), result, filename))
            conn.commit()
            print(f"DB 상태 업데이트 완료: {filename} -> {status}")
    except Exception as e:
        print(f"DB 업데이트 오류: {e}")