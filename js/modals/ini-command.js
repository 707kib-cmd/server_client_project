// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🎛️ Modals - INI Command Module - INI 명령 전송 모달 관련 기능
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 카드에서 IP 정보를 추출하는 헬퍼 함수
function getCardIpFromInfo(card) {
    const infoDiv = card.querySelector('.info');
    if (!infoDiv) return '';

    const infoText = infoDiv.textContent || '';
    const lines = infoText.split('\n').map(line => line.trim()).filter(line => line);

    // 첫 번째 줄이 IP 주소인 경우가 많음
    if (lines.length > 0) {
        const firstLine = lines[0];
        // IP 주소 패턴 매칭 (간단한 형태)
        const ipMatch = firstLine.match(/\d+\.\d+\.\d+\.\d+/);
        if (ipMatch) {
            return ipMatch[0];
        }
    }

    return '';
}

// INI 명령 시스템 초기화
function initializeCommandSystem() {
    initializeCommandModal();
    updateTemplateButtons();
    initializeModalContent();
}

// 모달 관리 초기화
function initializeCommandModal() {
    const modal = document.getElementById('commandModal');
    const openBtn = document.getElementById('openCommandModal');
    const closeBtn = document.querySelector('#commandModal .close');
    const cancelBtn = document.getElementById('cancelCommand');
    const sendBtn = document.getElementById('sendCommand');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            setIsCommandModalOpen(true);
            updateTargetCounts();
            updateTargetPreviews();
        });
    }

    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
                setIsCommandModalOpen(false);
            });
        }
    });

    if (sendBtn) {
        sendBtn.addEventListener('click', sendIniCommand);
    }

    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            setIsCommandModalOpen(false);
        }
    });
}

// 모달 콘텐츠 초기화
function initializeModalContent() {
    // 라디오 버튼 이벤트
    document.querySelectorAll('input[name="target"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateTargetCounts();
            updateTargetPreviews();
        });
    });

    // 전체보기 버튼 이벤트는 HTML에서 onclick으로 처리
    updateTargetCounts();
}

// 대상 목록 토글
function toggleTargetList(targetType) {
    const listDiv = document.getElementById(`${targetType}TargetList`);
    const showBtn = document.getElementById(`${targetType}ShowAllBtn`);

    // 현재 상태 확인
    const isVisible = listDiv.style.display === 'grid' ||
                     (listDiv.style.display !== 'none' && listDiv.innerHTML.trim() !== '');

    // 다른 모든 목록 닫기
    ['all', 'filtered', 'selected'].forEach(type => {
        if (type !== targetType) {
            const otherList = document.getElementById(`${type}TargetList`);
            const otherBtn = document.getElementById(`${type}ShowAllBtn`);
            if (otherList) {
                otherList.style.display = 'none';
                otherList.innerHTML = '';
                otherList.classList.remove('grid-view');
            }
            if (otherBtn) {
                otherBtn.textContent = '전체보기';
                otherBtn.style.background = '#f0f0f0';
                otherBtn.style.color = '#666';
            }
        }
    });

    if (isVisible) {
        // 닫기
        listDiv.style.display = 'none';
        listDiv.innerHTML = '';
        listDiv.classList.remove('grid-view');
        showBtn.textContent = '전체보기';
        showBtn.style.background = '#f0f0f0';
        showBtn.style.color = '#666';
    } else {
        // 열기 - 그리드 뷰로 설정
        listDiv.style.display = 'grid';
        listDiv.classList.add('grid-view');
        showBtn.textContent = '숨기기';
        showBtn.style.background = '#007bff';
        showBtn.style.color = 'white';
        updateTargetListContent(targetType);
    }
}

// 대상 미리보기 업데이트
function updateTargetPreview(targetType) {
    const clients = getTargetClientsByType(targetType);
    const previewSpan = document.getElementById(`${targetType}Preview`);

    if (clients.length === 0) {
        previewSpan.textContent = '없음';
    } else if (clients.length <= 5) {
        previewSpan.textContent = clients.map(c => c.name).join(', ');
    } else {
        const first5 = clients.slice(0, 5).map(c => c.name).join(', ');
        previewSpan.textContent = `${first5} 외 ${clients.length - 5}개`;
    }
}

// 대상 목록 내용 업데이트
function updateTargetListContent(targetType) {
    const clients = getTargetClientsByType(targetType);
    const listDiv = document.getElementById(`${targetType}TargetList`);

    if (clients.length === 0) {
        listDiv.innerHTML = '<div style="padding:8px; color:#666;">대상이 없습니다.</div>';
        return;
    }

    listDiv.innerHTML = clients.map(client => `
        <div class="client-item ${client.selected ? 'selected' : ''}"
             onclick="toggleClientInTargetList('${client.name}', this)">
            <input type="checkbox" ${client.selected ? 'checked' : ''}
                   onchange="toggleClientInTargetList('${client.name}', this.parentElement);">
            <span>${client.name}</span>
        </div>
    `).join('');
}

// 대상 타입별 클라이언트 목록 가져오기
function getTargetClientsByType(targetType) {
    const allCards = document.querySelectorAll('.card[data-name]:not(.empty)');

    switch (targetType) {
        case 'all':
            return Array.from(allCards).map(card => ({
                name: card.dataset.name,
                ip: getCardIpFromInfo(card),
                selected: getSelectedClients().has(card.dataset.name)
            }));

        case 'filtered':
            return Array.from(allCards)
                .filter(card => !card.classList.contains('ghost-card'))
                .map(card => ({
                    name: card.dataset.name,
                    ip: getCardIpFromInfo(card),
                    selected: getSelectedClients().has(card.dataset.name)
                }));

        case 'selected':
            return Array.from(allCards)
                .filter(card => getSelectedClients().has(card.dataset.name))
                .map(card => ({
                    name: card.dataset.name,
                    ip: getCardIpFromInfo(card),
                    selected: true
                }));

        default:
            return [];
    }
}

// 전체 대상 표시
function showAllTargets(targetType) {
    // 해당 라디오 버튼 자동 선택
    const radio = document.querySelector(`input[name="target"][value="${targetType}"]`);
    if (radio) {
        radio.checked = true;
        // 타겟 카운트 업데이트
        updateTargetCounts();
    }

    toggleTargetList(targetType);
}

// 현재 활성 대상 타입 가져오기
function getCurrentActiveTarget() {
    const checkedRadio = document.querySelector('input[name="target"]:checked');
    return checkedRadio ? checkedRadio.value : 'all';
}

// 대상 목록에서 클라이언트 토글
function toggleClientInTargetList(clientName, element) {
    const checkbox = element.querySelector('input[type="checkbox"]');

    // 텍스트나 div를 클릭한 경우에만 체크박스 상태를 토글
    // 체크박스 자체를 클릭한 경우는 onchange에서 처리됨
    if (event && event.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
    }

    // 실제 카드 선택 상태도 동기화
    const card = Array.from(document.querySelectorAll('.card')).find(c =>
        c.querySelector('.name')?.textContent === clientName
    );

    if (card) {
        if (checkbox.checked) {
            card.classList.add('selected');
            addSelectedClient(clientName);
            element.classList.add('selected');
        } else {
            card.classList.remove('selected');
            removeSelectedClient(clientName);
            element.classList.remove('selected');
        }
    }

    updateTargetCounts();
    updateTargetPreviews();
}

// 대상 클라이언트 목록 가져오기 (전송용)
function getTargetClients() {
    const activeTarget = getCurrentActiveTarget();
    const clients = getTargetClientsByType(activeTarget);

    switch (activeTarget) {
        case 'all':
            return clients.map(client => ({
                name: client.name,
                ip: client.ip.replace(/[^0-9.]/g, '') // IP에서 숫자와 점만 추출
            }));

        case 'filtered':
            return clients.map(client => ({
                name: client.name,
                ip: client.ip.replace(/[^0-9.]/g, '')
            }));

        case 'selected':
            return clients.filter(client => client.selected).map(client => ({
                name: client.name,
                ip: client.ip.replace(/[^0-9.]/g, '')
            }));

        default:
            return [];
    }
}

// 클라이언트 IP 가져오기
function getClientIP(clientName) {
    const card = Array.from(document.querySelectorAll('.card')).find(c =>
        c.querySelector('.name')?.textContent === clientName
    );

    if (card) {
        const ipText = getCardIpFromInfo(card);
        return ipText.replace(/[^0-9.]/g, ''); // 숫자와 점만 추출
    }

    return '';
}

// 대상 개수 업데이트
function updateTargetCounts() {
    const allCount = getTargetClientsByType('all').length;
    const filteredCount = getTargetClientsByType('filtered').length;
    const selectedCount = getTargetClientsByType('selected').length;

    const allCountEl = document.getElementById('allCount');
    const filteredCountEl = document.getElementById('filteredCount');
    const selectedCountEl = document.getElementById('selectedCount');

    if (allCountEl) allCountEl.textContent = allCount;
    if (filteredCountEl) filteredCountEl.textContent = filteredCount;
    if (selectedCountEl) selectedCountEl.textContent = selectedCount;

    // 미리보기 텍스트 업데이트
    updateTargetPreviews();
}

// 대상 미리보기 업데이트
function updateTargetPreviews() {
    updateTargetPreview('all');
    updateTargetPreview('filtered');
    updateTargetPreview('selected');
}

// 선택된 클라이언트 표시 업데이트 (레거시)
function updateSelectedClientsDisplay() {
    const selected = Array.from(getSelectedClients());
    const display = document.getElementById('selectedClientsDisplay');

    if (display) {
        if (selected.length === 0) {
            display.textContent = '선택된 클라이언트가 없습니다.';
        } else if (selected.length <= 5) {
            display.textContent = selected.join(', ');
        } else {
            display.textContent = `${selected.slice(0, 5).join(', ')} 외 ${selected.length - 5}개`;
        }
    }
}

// 로그 추가
function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    const timestamp = new Date().toLocaleTimeString();
    const logClass = type === 'error' ? 'log-error' :
        type === 'success' ? 'log-success' : 'log-info';

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${logClass}`;
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;

    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}

// 로그 초기화
function clearLog() {
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '전송을 시작하면 로그가 여기에 표시됩니다.';
    }
}