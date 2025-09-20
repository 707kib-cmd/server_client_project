
"""
🎮 클라이언트 상태 모니터링 시스템 - Flask 웹 서버

📋 주요 기능:
1. 🎴 실시간 클라이언트 상태 대시보드 (카드 형태로 표시)
   - 각 게임 클라이언트의 접속 상태, IP, 서버, 다이아 수량 등을 실시간 모니터링
   - 드래그 앤 드롭으로 카드 순서 변경 가능
   - 검색/필터링 기능 (다이아 수량, 클라이언트명, 서버명)

2. 📊 다이아 히스토리 차트 (별도 페이지)
   - 일별 다이아 수량 변화 추이를 차트로 시각화
   - 전일 대비 증감 계산 및 표시

🗃️ 데이터베이스:
- SQLite 사용 (../server/client_status.db)
- clients 테이블: 실시간 클라이언트 상태 정보
- daily_dia 테이블: 일별 다이아 기록 히스토리

🌐 API 엔드포인트:
- GET /              → 메인 대시보드 페이지
- GET /api/clients   → 클라이언트 상태 데이터 (JSON)
- GET /dia-history   → 다이아 히스토리 페이지
- GET /api/dia-history → 다이아 히스토리 데이터 (JSON)

🎯 용도: 게임 봇/클라이언트 관리 시스템 (다중 서버, 다중 계정 모니터링)
"""

from flask import Flask, render_template, jsonify, request, make_response
import sqlite3
import os
import datetime
import json
from server_send import send_ini_command

# ───────────────────────────────────────────────────────
# Flask 애플리케이션 설정
# ───────────────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder='../css',     # CSS 폴더
    static_url_path='/css',     # CSS URL 경로
    template_folder='../'       # 프로젝트 루트 HTML 파일들
)

# 🗃️ 데이터베이스 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, '..', 'server', 'client_status.db')
print("▶ 실제 사용하는 DB_PATH:", DB_PATH, flush=True)

# 🌐 CORS 설정 (파일 직접 접근 허용)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


def init_ini_commands_db():
    """INI 명령 이력 테이블 초기화"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ini_commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_ip TEXT NOT NULL,
                client_name TEXT,
                filename TEXT NOT NULL,
                command_content TEXT NOT NULL,
                sent_timestamp DATETIME NOT NULL,
                execution_status TEXT DEFAULT 'PENDING',
                execution_timestamp DATETIME,
                execution_result TEXT,
                error_message TEXT
            )
        ''')
        conn.commit()

# ───────────────────────────────────────────────────────
# 1) 🎴 카드보드용 페이지 & API  (clients 테이블)
#    → dashboard.js에서 이 API들을 호출해서 카드 생성
# ───────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    """
    🏠 메인 대시보드 페이지 렌더링
    - clients 테이블에서 모든 클라이언트 정보를 가져와서
    - dashboard.html 템플릿에 전달 (초기 로딩용)
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM clients ORDER BY last_report DESC"
        ).fetchall()
    return render_template('index.html', data=rows)

# JS 파일 라우트 추가
@app.route('/js/<path:filename>')
def js_files(filename):
    """JS 파일 서빙"""
    from flask import send_from_directory
    js_dir = os.path.join(BASE_DIR, '..', 'js')
    return send_from_directory(js_dir, filename)


@app.route('/api/clients')
def api_clients():
    """
    📡 클라이언트 데이터 API - dashboard.js의 fetchClients()에서 호출

    ✅ 이게 바로 dashboard.js에서 fetch("/api/clients")로 요청하는 엔드포인트!

    반환 데이터 구조:
    [
      {
        "name": "클라이언트명",
        "server": "서버명",
        "dia": "다이아 수량",
        "ip": "IP 주소",
        "game": "게임명",
        "status": "상태값",
        "last_report": "마지막 접속 시간"
      },
      ...
    ]
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM clients ORDER BY last_report DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ───────────────────────────────────────────────────────
# 2) 📊 다이아보드용 페이지 & API  (daily_dia 테이블)
#    → 별도 차트 페이지용 (dashboard.js와는 독립적)
# ─ ───────────────────────────────────────────────────────

@app.route('/dia-history')
def dia_history_page():
    """dia-history.html 렌더링 — 차트 전용 페이지"""
    return render_template('dia-history.html')


@app.route('/api/dia-history')
def api_dia_history():
    """
    💎 다이아 히스토리 데이터 API

    파라미터:
    - days: 조회할 일수 (기본값: 7일)

    처리 로직:
    1. 오늘부터 과거 N일간의 날짜 리스트 생성
    2. daily_dia 테이블에서 해당 기간 데이터 조회
    3. 날짜별/클라이언트별로 데이터 집계
    4. 전일 대비 증감(diff) 계산
    """
    # 📅 조회 기간 설정 (기본 7일)
    days = int(request.args.get('days', 7))
    today = datetime.date.today()

    # today 부터 과거 days일 리스트
    wanted = [
        (today - datetime.timedelta(days=i)).isoformat()
        for i in range(days)
    ]

    # 🔍 SQL 쿼리: IN 절을 이용해 특정 날짜들만 조회
    placeholders = ','.join('?' * len(wanted))
    sql = f"""
    SELECT
      substr(date,1,10) AS day,
      name,
      game,
      server,
      dia
    FROM daily_dia
    WHERE substr(date,1,10) IN ({placeholders})
    ORDER BY day ASC, name ASC
    """

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, wanted).fetchall()

    # 📊 데이터 가공: 날짜별 TOTAL 합산 및 구조 정리
    stats = {d: {'TOTAL': 0} for d in wanted}
    for r in rows:
        d = r['day']
        stats[d][r['name']] = {
            'today': r['dia'],
            'diff': 0,  # 전일 대비 증감 (아래에서 계산)
            'game': r['game'],
            'server': r['server']
        }
        stats[d]['TOTAL'] += r['dia']  # 일별 총합 계산

    # diff 계산: 전일 대비 today 차이
    for d in wanted:
        prev = (datetime.date.fromisoformat(d) - datetime.timedelta(days=1)).isoformat()
        for name, info in stats[d].items():
            if name == 'TOTAL':
                continue
            prev_info = stats.get(prev, {}).get(name)
            info['diff'] = info['today'] - (prev_info['today'] if prev_info else 0) # 어제 데이터가 있으면 차이 계산, 없으면 현재값 그대로

    return jsonify(stats)

@app.route('/api/send-ini', methods=['POST'])
def send_ini_command():
    """선택된 클라이언트들에게 INI 명령 전송"""
    try:
        data = request.get_json()
        selected_clients = data.get('clients', [])
        ini_content = data.get('ini_content', '')

        if not selected_clients or not ini_content:
            return jsonify({'success': False, 'message': '클라이언트 또는 명령이 비어있습니다'})

        # 타임스탬프 생성
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")

        success_count = 0
        success_clients = []  # 성공 목록 추가
        error_messages = []

        for client in selected_clients:
            try:
                # 파일명 생성
                filename = f"{client['ip']}_{timestamp}.ini"

                # DB에 전송 기록 저장
                with sqlite3.connect(DB_PATH) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO ini_commands 
                        (client_ip, client_name, filename, command_content, sent_timestamp, execution_status)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (client['ip'], client['name'], filename, ini_content,
                          datetime.datetime.now(), 'PENDING'))
                    conn.commit()

                # server_send.py로 실제 전송
                from server_send import send_ini_command as send_ini
                result = send_ini(client['ip'], filename, ini_content)

                if 'SUCCESS' in result:
                    success_count += 1
                    success_clients.append(f"{client['name']} ({client['ip']})")  # 성공 목록에 추가
                else:
                    error_messages.append(f"{client['name']}: {result}")

            except Exception as e:
                error_messages.append(f"{client['name']}: {str(e)}")

        return jsonify({
            'success': True,
            'message': f'{success_count}개 클라이언트에 명령 전송 완료',
            'success_clients': success_clients,  # 성공 목록 추가
            'errors': error_messages
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'전송 실패: {str(e)}'})

# ───────────────────────────────────────────────────────
# 서버 상태 확인 API
# ───────────────────────────────────────────────────────
@app.route('/api/server-status')
def get_server_status():
    """메인 서버와 웹 서버 상태 확인"""
    import socket
    import psutil
    import os

    status = {
        'main_server': False,
        'web_server': True,  # 이 API가 응답하면 웹서버는 실행중
        'main_server_port': 5050,
        'web_server_port': 8000,
        'processes': []
    }

    try:
        # 메인 서버 포트 5050 확인 (여러 IP 시도)
        ips_to_check = ['127.0.0.1', '172.30.101.232', 'localhost']
        status['main_server'] = False

        for ip in ips_to_check:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((ip, 5050))
                sock.close()
                if result == 0:
                    status['main_server'] = True
                    status['main_server_ip'] = ip
                    break
            except:
                continue
    except:
        status['main_server'] = False

    try:
        # 실행중인 Python 프로세스 확인
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] == 'python.exe' or proc.info['name'] == 'python':
                    cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                    if 'server.py' in cmdline:
                        status['processes'].append({
                            'name': '메인 서버',
                            'pid': proc.info['pid'],
                            'file': 'server.py'
                        })
                    elif 'app.py' in cmdline:
                        status['processes'].append({
                            'name': '웹 서버',
                            'pid': proc.info['pid'],
                            'file': 'app.py'
                        })
            except:
                continue
    except:
        pass

    return jsonify(status)

@app.route('/api/start-server', methods=['POST'])
def start_server():
    """서버 시작"""
    import subprocess
    import os

    data = request.get_json()
    server_type = data.get('type', '')

    try:
        if server_type == 'main':
            # 메인 서버 시작
            server_path = os.path.join(os.path.dirname(__file__), '..', 'server', 'server.py')
            if os.path.exists(server_path):
                subprocess.Popen(['python', '-X', 'utf8', server_path],
                               cwd=os.path.dirname(server_path),
                               creationflags=subprocess.CREATE_NEW_CONSOLE)
                return jsonify({'success': True, 'message': '메인 서버 시작 중...'})
            else:
                return jsonify({'success': False, 'message': '메인 서버 파일을 찾을 수 없습니다'})

        elif server_type == 'web':
            # 웹 서버는 이미 실행중이므로 메시지만
            return jsonify({'success': True, 'message': '웹 서버는 이미 실행중입니다'})

        else:
            return jsonify({'success': False, 'message': '알 수 없는 서버 타입'})

    except Exception as e:
        return jsonify({'success': False, 'message': f'서버 시작 실패: {str(e)}'})

# ───────────────────────────────────────────────────────
# 서버 실행
# ───────────────────────────────────────────────────────
if __name__ == '__main__':
    init_ini_commands_db()  # INI 명령 테이블 초기화
    print("▶ Available routes:", app.url_map, flush=True)
    app.run(debug=True, port=8000)