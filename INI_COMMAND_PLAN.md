# 🎯 카드보드 INI 파일 명령 전송 구현 계획서

## 📋 개요
웹 대시보드에서 클라이언트에게 INI 파일 형태로 명령을 전송하는 기능 구현

### 🎯 목표
- 전체/검색/선택한 클라이언트에게 INI 파일 전송
- 사용자가 직접 INI 내용 작성 가능
- 미리 정의된 템플릿 제공
- 전송 결과 피드백

---

## 🔧 1단계: UI 설계 및 구현

### 📄 dashboard.html 수정

#### 1.1 명령 전송 버튼 추가
```html
<!-- 기존 필터 영역 아래에 추가 -->
<div class="command-section">
    <button id="openCommandModal" class="btn-command">📤 INI 명령 전송</button>
</div>
```

#### 1.2 명령 작성 모달 추가
```html
<!-- body 태그 끝나기 전에 추가 -->
<div id="commandModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>📤 INI 명령 전송</h3>
            <span class="close">&times;</span>
        </div>

        <!-- 대상 선택 섹션 -->
        <div class="target-selection">
            <h4>📍 전송 대상</h4>
            <label><input type="radio" name="target" value="all" checked> 전체 클라이언트 (<span id="allCount">0</span>개)</label>
            <label><input type="radio" name="target" value="filtered"> 현재 필터링된 클라이언트 (<span id="filteredCount">0</span>개)</label>
            <label><input type="radio" name="target" value="selected"> 선택된 클라이언트 (<span id="selectedCount">0</span>개)</label>
            <div id="selectedClients" class="selected-display"></div>
        </div>

        <!-- INI 템플릿 선택 -->
        <div class="template-section">
            <h4>📝 템플릿 선택</h4>
            <div class="template-buttons">
                <button type="button" onclick="loadTemplate('start')">▶️ 시작</button>
                <button type="button" onclick="loadTemplate('stop')">⏹️ 정지</button>
                <button type="button" onclick="loadTemplate('restart')">🔄 재시작</button>
                <button type="button" onclick="loadTemplate('custom')">⚙️ 커스텀</button>
                <button type="button" onclick="clearTemplate()">🗑️ 지우기</button>
            </div>
        </div>

        <!-- INI 내용 작성 -->
        <div class="ini-editor">
            <h4>📋 INI 파일 내용</h4>
            <textarea id="iniContent" rows="15" placeholder="[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000"></textarea>
        </div>

        <!-- 전송 버튼 -->
        <div class="modal-footer">
            <button id="sendCommand" class="btn-send">🚀 INI 파일 전송</button>
            <button id="cancelCommand" class="btn-cancel">❌ 취소</button>
        </div>
    </div>
</div>

<!-- 로딩 오버레이 -->
<div id="loadingOverlay" class="loading-overlay">
    <div class="loading-content">
        <div class="spinner"></div>
        <p id="loadingMessage">전송 중...</p>
    </div>
</div>
```

---

## 🔧 2단계: JavaScript 기능 구현

### 📄 dashboard.js 추가 함수

#### 2.1 전역 변수 및 초기화
```javascript
// 전역 변수
let selectedClients = new Set();
let isCommandModalOpen = false;

// 초기화 함수 (기존 fetchClients 함수 끝에 추가)
function initializeCommandSystem() {
    initializeCardSelection();
    initializeCommandModal();
    updateTargetCounts();
}
```

#### 2.2 카드 선택 시스템
```javascript
function initializeCardSelection() {
    // 카드 클릭으로 선택/해제 (Ctrl+클릭)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.card[data-name]');
        if (card && e.ctrlKey && !card.classList.contains('empty')) {
            e.preventDefault();
            toggleCardSelection(card);
        }
    });

    // 전체 선택/해제 (Ctrl+A)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'a' && isCommandModalOpen) {
            e.preventDefault();
            selectAllVisibleCards();
        }
    });
}

function toggleCardSelection(card) {
    const clientName = card.dataset.name;

    if (selectedClients.has(clientName)) {
        selectedClients.delete(clientName);
        card.classList.remove('selected');
    } else {
        selectedClients.add(clientName);
        card.classList.add('selected');
    }

    updateSelectedClientsDisplay();
    updateTargetCounts();
}

function selectAllVisibleCards() {
    const visibleCards = document.querySelectorAll('.card[data-name]:not(.empty):not([style*="display: none"]):not(.ghost-card)');

    visibleCards.forEach(card => {
        const clientName = card.dataset.name;
        selectedClients.add(clientName);
        card.classList.add('selected');
    });

    updateSelectedClientsDisplay();
    updateTargetCounts();
}

function clearAllSelections() {
    selectedClients.clear();
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    updateSelectedClientsDisplay();
    updateTargetCounts();
}
```

#### 2.3 모달 관리
```javascript
function initializeCommandModal() {
    const modal = document.getElementById('commandModal');
    const openBtn = document.getElementById('openCommandModal');
    const closeBtn = document.querySelector('#commandModal .close');
    const cancelBtn = document.getElementById('cancelCommand');
    const sendBtn = document.getElementById('sendCommand');

    // 모달 열기
    openBtn.onclick = () => {
        modal.style.display = 'block';
        isCommandModalOpen = true;
        updateTargetCounts();
    };

    // 모달 닫기
    const closeModal = () => {
        modal.style.display = 'none';
        isCommandModalOpen = false;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    // 배경 클릭으로 닫기
    window.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // 전송 버튼
    sendBtn.onclick = sendIniCommand;

    // 대상 선택 변경 시 카운트 업데이트
    document.querySelectorAll('input[name="target"]').forEach(radio => {
        radio.onchange = updateTargetCounts;
    });
}
```

#### 2.4 대상 클라이언트 수집 및 표시
```javascript
function getTargetClients() {
    const targetType = document.querySelector('input[name="target"]:checked').value;
    const allCards = document.querySelectorAll('.card[data-name]:not(.empty)');

    switch (targetType) {
        case 'all':
            return Array.from(allCards).map(card => ({
                name: card.dataset.name,
                ip: card.dataset.ip || 'unknown'
            }));

        case 'filtered':
            return Array.from(allCards)
                .filter(card => card.style.display !== 'none' && !card.classList.contains('ghost-card'))
                .map(card => ({
                    name: card.dataset.name,
                    ip: card.dataset.ip || 'unknown'
                }));

        case 'selected':
            return Array.from(selectedClients).map(name => {
                const card = document.querySelector(`.card[data-name="${name}"]`);
                return {
                    name: name,
                    ip: card?.dataset.ip || 'unknown'
                };
            });

        default:
            return [];
    }
}

function updateTargetCounts() {
    const allCount = document.querySelectorAll('.card[data-name]:not(.empty)').length;
    const filteredCount = document.querySelectorAll('.card[data-name]:not(.empty):not([style*="display: none"]):not(.ghost-card)').length;
    const selectedCount = selectedClients.size;

    document.getElementById('allCount').textContent = allCount;
    document.getElementById('filteredCount').textContent = filteredCount;
    document.getElementById('selectedCount').textContent = selectedCount;
}

function updateSelectedClientsDisplay() {
    const display = document.getElementById('selectedClients');

    if (selectedClients.size > 0) {
        const clientList = Array.from(selectedClients).join(', ');
        display.innerHTML = `<strong>선택됨:</strong> ${clientList}`;
        display.style.display = 'block';
    } else {
        display.style.display = 'none';
    }
}
```

#### 2.5 INI 템플릿 시스템
```javascript
const iniTemplates = {
    start: `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000

[Metadata]
created_by=dashboard
description=Start VM Flow Process`,

    stop: `[Commands]
action=STOP
target=VM_Flow_LoY.exe
force=false
save_state=true

[Settings]
graceful_shutdown=true
timeout=15000

[Metadata]
created_by=dashboard
description=Stop VM Flow Process`,

    restart: `[Commands]
action=RESTART
target=VM_Flow_LoY.exe
delay_before=2000
delay_after=5000

[Settings]
backup_before_restart=true
verify_after_restart=true

[Metadata]
created_by=dashboard
description=Restart VM Flow Process`,

    custom: `[CustomSection]
custom_parameter=value

[Commands]
action=CUSTOM
parameters=param1,param2,param3
target=custom_target

[Settings]
custom_setting=enabled`
};

function loadTemplate(templateName) {
    const textarea = document.getElementById('iniContent');
    if (iniTemplates[templateName]) {
        textarea.value = iniTemplates[templateName];
    }
}

function clearTemplate() {
    document.getElementById('iniContent').value = '';
}
```

#### 2.6 INI 전송 함수
```javascript
async function sendIniCommand() {
    const iniContent = document.getElementById('iniContent').value.trim();
    const targets = getTargetClients();

    // 유효성 검사
    if (!iniContent) {
        alert('⚠️ INI 내용을 입력해주세요.');
        return;
    }

    if (targets.length === 0) {
        alert('⚠️ 전송할 대상이 없습니다.');
        return;
    }

    // 확인 대화상자
    const targetType = document.querySelector('input[name="target"]:checked').value;
    const typeNames = { all: '전체', filtered: '필터링된', selected: '선택된' };
    const confirmMessage = `${typeNames[targetType]} ${targets.length}개 클라이언트에게 INI 명령을 전송하시겠습니까?`;

    if (!confirm(confirmMessage)) return;

    // INI 데이터 구성
    const iniData = {
        content: iniContent,
        targets: targets,
        timestamp: new Date().toISOString(),
        filename: `command_${Date.now()}.ini`,
        sender: 'dashboard',
        target_type: targetType
    };

    try {
        showLoading(`📤 ${targets.length}개 클라이언트에게 INI 파일 전송 중...`);

        const response = await fetch('/api/send-ini-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(iniData)
        });

        const result = await response.json();

        if (result.success) {
            const successMsg = `✅ 전송 완료!\n성공: ${result.sent_count}/${result.total_count}`;
            if (result.failed_targets && result.failed_targets.length > 0) {
                const failedNames = result.failed_targets.map(f => f.name).join(', ');
                alert(successMsg + `\n실패: ${failedNames}`);
            } else {
                alert(successMsg);
            }

            // 모달 닫기 및 초기화
            document.getElementById('commandModal').style.display = 'none';
            isCommandModalOpen = false;
            clearAllSelections();

        } else {
            alert(`❌ 전송 실패: ${result.error}`);
        }

    } catch (error) {
        alert(`❌ 전송 오류: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 로딩 표시 함수
function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}
```

---

## 🔧 3단계: Flask API 구현

### 📄 board/app.py 수정

#### 3.1 필요한 import 추가
```python
import tempfile
import os
import time
import socket
import threading
from datetime import datetime
```

#### 3.2 INI 명령 전송 API 엔드포인트
```python
@app.route('/api/send-ini-command', methods=['POST'])
def send_ini_command():
    """INI 파일 명령을 클라이언트들에게 전송"""
    try:
        data = request.json
        ini_content = data.get('content', '').strip()
        targets = data.get('targets', [])
        filename = data.get('filename', f'command_{int(time.time())}.ini')
        sender = data.get('sender', 'dashboard')
        target_type = data.get('target_type', 'unknown')

        # 유효성 검사
        if not ini_content:
            return jsonify({'success': False, 'error': 'INI 내용이 없습니다'})

        if not targets or len(targets) == 0:
            return jsonify({'success': False, 'error': '전송할 대상이 없습니다'})

        # 로그 기록
        log_message = f"INI 명령 전송 시작 → 대상타입: {target_type}, 대상수: {len(targets)}, 파일: {filename}"
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {log_message}")

        # INI 파일 생성 및 전송
        success_count = 0
        failed_targets = []
        results = []

        # 각 클라이언트에게 전송
        for target in targets:
            try:
                client_name = target.get('name', 'unknown')
                client_ip = target.get('ip', 'unknown')

                # INI 파일에 메타데이터 헤더 추가
                ini_with_header = create_ini_with_metadata(
                    ini_content, filename, sender, client_name
                )

                # 서버로 전송 요청
                send_result = send_ini_to_server(client_ip, ini_with_header, filename, client_name)

                if send_result['success']:
                    success_count += 1
                    results.append({'target': client_name, 'status': 'SUCCESS'})
                else:
                    failed_targets.append({'name': client_name, 'error': send_result['error']})
                    results.append({'target': client_name, 'status': f'FAILED: {send_result["error"]}'})

            except Exception as e:
                error_msg = str(e)
                failed_targets.append({'name': target.get('name', 'unknown'), 'error': error_msg})
                results.append({'target': target.get('name', 'unknown'), 'status': f'ERROR: {error_msg}'})

        # 결과 로그 기록
        result_message = f"INI 명령 전송 완료 → 성공: {success_count}/{len(targets)}, 실패: {len(failed_targets)}"
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {result_message}")

        return jsonify({
            'success': True,
            'sent_count': success_count,
            'total_count': len(targets),
            'failed_targets': failed_targets,
            'results': results,
            'filename': filename
        })

    except Exception as e:
        error_message = f"INI 전송 API 오류: {str(e)}"
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ❌ {error_message}")
        return jsonify({'success': False, 'error': error_message})

def create_ini_with_metadata(ini_content, filename, sender, target_name):
    """INI 파일에 메타데이터 헤더 추가"""
    metadata_header = f"""[INI_FILE_INFO]
filename={filename}
timestamp={datetime.now().isoformat()}
sender={sender}
target={target_name}
created_from=dashboard

"""
    return metadata_header + ini_content

def send_ini_to_server(client_ip, ini_content, filename, client_name):
    """서버에 INI 파일 전송 요청"""
    try:
        # 서버 설정 읽기
        server_config = load_server_config()
        server_ip = server_config.get('server_ip', '127.0.0.1')
        server_port = server_config.get('server_port', 5050)

        # 서버로 INI 전송 명령 보내기
        command_data = {
            'action': 'SEND_INI',
            'target_ip': client_ip,
            'target_name': client_name,
            'ini_content': ini_content,
            'filename': filename
        }

        # TCP 소켓으로 서버에 명령 전송
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(10)
            sock.connect((server_ip, server_port))

            # JSON 형태로 명령 전송
            command_json = json.dumps(command_data, ensure_ascii=False)
            sock.sendall(command_json.encode('utf-8'))

            # 응답 받기
            response = sock.recv(1024).decode('utf-8')

        return {'success': True, 'response': response}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def load_server_config():
    """서버 설정 로드"""
    try:
        server_settings_path = os.path.join('..', 'server', 'settings.json')
        with open(server_settings_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'server_ip': '127.0.0.1', 'server_port': 5050}
```

---

## 🔧 4단계: 서버 INI 전송 기능

### 📄 server/server.py 수정

#### 4.1 INI 전송 함수 추가
```python
def send_ini_to_client(client_ip, ini_content, filename, client_name):
    """클라이언트에게 INI 파일 형태로 명령 전송"""
    try:
        # 클라이언트 recv_port는 config에서 6000으로 설정됨
        client_port = 6000

        # INI 파일 프로토콜 헤더 생성
        protocol_header = f"INI_FILE:{len(ini_content)}:{filename}\n"
        full_message = protocol_header + ini_content

        # TCP 소켓으로 전송
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(15)  # 15초 타임아웃
            sock.connect((client_ip, client_port))
            sock.sendall(full_message.encode('utf-8'))

            # 응답 확인 (옵션)
            try:
                response = sock.recv(256).decode('utf-8')
                log(f"📤 INI 전송 성공 → {client_name}({client_ip}) | 파일: {filename} | 응답: {response}", DEFAULT_CONFIG["log_path"])
            except:
                log(f"📤 INI 전송 성공 → {client_name}({client_ip}) | 파일: {filename} | 응답 없음", DEFAULT_CONFIG["log_path"])

        return True

    except Exception as e:
        log(f"⚠️ INI 전송 실패 → {client_name}({client_ip}) | 파일: {filename} | 오류: {e}", DEFAULT_CONFIG["log_path"])
        return False

def handle_ini_command(command_data):
    """웹 대시보드에서 온 INI 명령 처리"""
    try:
        action = command_data.get('action')
        if action != 'SEND_INI':
            return "UNKNOWN_ACTION"

        target_ip = command_data.get('target_ip')
        target_name = command_data.get('target_name')
        ini_content = command_data.get('ini_content')
        filename = command_data.get('filename')

        # INI 파일 전송
        result = send_ini_to_client(target_ip, ini_content, filename, target_name)

        return "SUCCESS" if result else "FAILED"

    except Exception as e:
        log(f"⚠️ INI 명령 처리 실패: {e}", DEFAULT_CONFIG["log_path"])
        return f"ERROR:{e}"
```

#### 4.2 기존 handle_client 함수 수정
```python
def handle_client(conn, addr, log_path):
    try:
        raw = conn.recv(2048)
        if not raw:
            log(f"⚠️ 수신 실패: 빈 데이터 (IP: {addr[0]})", log_path)
            return

        try:
            # JSON 명령인지 확인 (웹 대시보드에서 온 명령)
            raw_str = raw.decode("utf-8")
            if raw_str.startswith('{') and raw_str.endswith('}'):
                command_data = json.loads(raw_str)
                response = handle_ini_command(command_data)
                conn.sendall(response.encode('utf-8'))
                return

            # 기존 클라이언트 상태 보고 처리
            payload = json.loads(raw_str)

        except Exception as e:
            log(f"⚠️ JSON 파싱 실패: {e}", log_path)
            return

        # ... 기존 클라이언트 처리 코드 ...

    except Exception as e:
        log(f"⚠️ 수신 처리 실패: {e}\\n{traceback.format_exc()}", log_path)
    finally:
        conn.close()
```

---

## 🔧 5단계: CSS 스타일링

### 📄 board/static/dashboard.css 추가

```css
/* 명령 전송 버튼 */
.command-section {
    margin: 10px 0;
    text-align: right;
}

.btn-command {
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-command:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

/* 카드 선택 상태 */
.card.selected {
    border-left: 3px solid #ff6b6b !important;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.4);
    transform: scale(1.02);
    transition: all 0.2s ease;
}

/* 모달 스타일 */
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    animation: fadeIn 0.3s ease;
}

.modal-content {
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    margin: 2% auto;
    padding: 0;
    border: none;
    border-radius: 12px;
    width: 90%;
    max-width: 900px;
    color: white;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #4a5568;
}

.modal-header h3 {
    margin: 0;
    color: #e2e8f0;
    font-size: 18px;
}

.close {
    font-size: 28px;
    font-weight: bold;
    color: #cbd5e0;
    cursor: pointer;
    transition: color 0.2s ease;
}

.close:hover {
    color: #ff6b6b;
}

/* 대상 선택 섹션 */
.target-selection {
    padding: 20px 25px;
    background: rgba(26, 32, 44, 0.5);
    border-bottom: 1px solid #4a5568;
}

.target-selection h4 {
    margin: 0 0 15px 0;
    color: #e2e8f0;
    font-size: 16px;
}

.target-selection label {
    display: block;
    margin: 12px 0;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 6px;
    transition: background 0.2s ease;
}

.target-selection label:hover {
    background: rgba(66, 153, 225, 0.1);
}

.target-selection input[type="radio"] {
    margin-right: 8px;
}

.selected-display {
    margin-top: 15px;
    padding: 12px;
    background: #2d3748;
    border-radius: 6px;
    font-size: 14px;
    border-left: 3px solid #4299e1;
}

/* 템플릿 섹션 */
.template-section {
    padding: 20px 25px;
    border-bottom: 1px solid #4a5568;
}

.template-section h4 {
    margin: 0 0 15px 0;
    color: #e2e8f0;
    font-size: 16px;
}

.template-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.template-buttons button {
    background: linear-gradient(45deg, #4299e1, #3182ce);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.template-buttons button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
}

.template-buttons button:last-child {
    background: linear-gradient(45deg, #e53e3e, #c53030);
}

/* INI 에디터 */
.ini-editor {
    padding: 20px 25px;
}

.ini-editor h4 {
    margin: 0 0 15px 0;
    color: #e2e8f0;
    font-size: 16px;
}

.ini-editor textarea {
    width: 100%;
    min-height: 300px;
    background: #1a202c;
    color: #e2e8f0;
    border: 2px solid #4a5568;
    border-radius: 8px;
    padding: 15px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s ease;
}

.ini-editor textarea:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.ini-editor textarea::placeholder {
    color: #718096;
}

/* 모달 푸터 */
.modal-footer {
    padding: 20px 25px;
    border-top: 1px solid #4a5568;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-send {
    background: linear-gradient(45deg, #48bb78, #38a169);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-send:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(72, 187, 120, 0.3);
}

.btn-cancel {
    background: #4a5568;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-cancel:hover {
    background: #2d3748;
}

/* 로딩 오버레이 */
.loading-overlay {
    display: none;
    position: fixed;
    z-index: 2000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
}

.loading-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
}

.spinner {
    border: 4px solid #4a5568;
    border-top: 4px solid #4299e1;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
    .modal-content {
        width: 95%;
        margin: 5% auto;
    }

    .template-buttons {
        justify-content: center;
    }

    .modal-footer {
        flex-direction: column;
    }

    .btn-send, .btn-cancel {
        width: 100%;
    }
}
```

---

## 🔧 6단계: 테스트 및 검증

### 📋 테스트 시나리오

#### 6.1 기본 기능 테스트
1. **모달 열기/닫기**
   - "📤 INI 명령 전송" 버튼 클릭
   - X 버튼, 취소 버튼, 배경 클릭으로 닫기

2. **카드 선택 테스트**
   - Ctrl+클릭으로 개별 카드 선택/해제
   - 선택된 카드 하이라이트 확인
   - 선택 수 카운트 확인

3. **템플릿 로드 테스트**
   - 각 템플릿 버튼 클릭
   - textarea에 내용 로드 확인
   - 지우기 버튼 테스트

#### 6.2 전송 기능 테스트
1. **전체 전송**: 모든 클라이언트에게 전송
2. **필터링 전송**: 검색 후 보이는 클라이언트에게만 전송
3. **선택 전송**: 수동 선택한 클라이언트에게만 전송

#### 6.3 오류 처리 테스트
1. **빈 내용 전송**: 경고 메시지 확인
2. **대상 없음**: 경고 메시지 확인
3. **네트워크 오류**: 오류 처리 확인

---

## 📋 사용법 가이드

### 🎯 전송 방법

1. **전체 전송**
   - "📤 INI 명령 전송" 버튼 클릭
   - "전체 클라이언트" 선택 (기본값)
   - 템플릿 선택 또는 직접 작성
   - "🚀 INI 파일 전송" 클릭

2. **필터링 전송**
   - 검색/필터로 원하는 클라이언트만 표시
   - "📤 INI 명령 전송" 버튼 클릭
   - "현재 필터링된 클라이언트" 선택
   - INI 내용 작성 후 전송

3. **선택 전송**
   - Ctrl+클릭으로 원하는 카드들 선택
   - "📤 INI 명령 전송" 버튼 클릭
   - "선택된 클라이언트" 선택
   - INI 내용 작성 후 전송

### 📝 INI 파일 예시
```ini
[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000

[CustomData]
user_id=admin
session_id=abc123
```

---

## 🚀 구현 순서

1. **HTML 수정** → 모달과 버튼 추가
2. **CSS 추가** → 스타일링 완성
3. **JavaScript 구현** → 클라이언트 측 기능
4. **Flask API 추가** → 서버 측 API
5. **서버 함수 수정** → INI 전송 로직
6. **테스트 및 디버깅** → 기능 검증

이 계획서를 순서대로 따라하면 완전한 INI 명령 전송 시스템이 구축됩니다.