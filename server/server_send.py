import socket
import json


def send_ini_command(client_ip, filename, content):
    """가상윈도우에 INI 명령 전송"""
    try:
        print(f"INI 전송 시작: {client_ip} -> {filename}")

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((client_ip, 5050))

        message = '{"source": "command"}'
        http_request = f"POST / HTTP/1.1\r\nContent-Length: {len(message)}\r\n\r\n{message}"

        sock.send(http_request.encode())
        response = sock.recv(1024).decode()
        sock.close()

        print(f"클라이언트 응답: {response}")
        return f"SUCCESS: {response}"

    except Exception as e:
        print(f"INI 전송 오류: {e}")
        return f"ERROR: {str(e)}"