// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🌐 API Core Module - 서버 통신 관련 함수들
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 🌐 URL 감지 및 API 경로 생성 함수
function getApiUrl(endpoint) {
    // file:// 프로토콜로 접근하는 경우 (직접 파일 접근)
    if (window.location.protocol === 'file:') {
        return `http://localhost:8000${endpoint}`;
    }
    // HTTP 프로토콜로 접근하는 경우 (Flask 서버 접근)
    return endpoint;
}

// 📡 클라이언트 데이터 가져오기
async function fetchClients() {
    const threshold = getThresholdMs();
    const now = Date.now();
    const clientOrder = getClientOrder();

    try {
        // 1) 데이터 가져오기
        const res = await fetch(getApiUrl("/api/clients"));
        const data = await res.json();

        updateServerSummary(data);

        // 2) 그리드 컨테이너 찾기
        const grid = document.getElementById("dashboard");
        if (!grid) {
            console.warn("❗ grid 요소가 존재하지 않습니다.");
            return;
        }

        // 3) 클라이언트 맵 & 순서
        const clientMap = {};
        data.forEach(c => {
            clientMap[c.name] = c;
        });

        // 기존 순서를 유지하되, 새 클라이언트도 추가
        const allNames = data.map(c => c.name);
        const orderedNames = clientOrder.filter(name => allNames.includes(name) || !clientMap[name]);
        const newNames = allNames.filter(name => !clientOrder.includes(name));
        const names = [...orderedNames, ...newNames];

        // 4) 카드 생성·업데이트
        names.forEach((name, index) => {
            const existing = grid.querySelector(`.card[data-name="${name}"]`);
            const c = clientMap[name];

            // 4-1) 이미 있으면 업데이트만
            if (existing) {
                if (c && !existing.classList.contains("empty")) {
                    // 기존 체크박스 상태 저장
                    const existingCheckbox = existing.querySelector('.card-checkbox');
                    const isChecked = existingCheckbox ? existingCheckbox.checked : false;

                    const cardHTML = getCondensed()
                        ? `
                            <input type="checkbox" class="card-checkbox" onchange="toggleCardByCheckbox(this, '${c.name}')" ${isChecked ? 'checked' : ''}>
                            <div class="name">${c.name}</div>
                            <div class="info">${c.server}<br>${c.dia}</div>
                        `
                        : `
                            <input type="checkbox" class="card-checkbox" onchange="toggleCardByCheckbox(this, '${c.name}')" ${isChecked ? 'checked' : ''}>
                            <div class="name">${c.name}</div>
                            <div class="info">
                                ${c.ip}<br>
                                ${c.game} (${c.server})<br>
                                ${c.dia}<br>
                                ${c.status.toUpperCase()}<br>
                                ${trimTimestamp(c.last_report)}
                            </div>
                        `;

                    console.log('✅ 카드 HTML 업데이트:', c.name, cardHTML.includes('checkbox'));
                    existing.innerHTML = cardHTML;
                }
                return;
            }

            // 4-2) 새 카드 생성
            const card = document.createElement("div");
            card.className = c ? "card" : "card empty";
            card.dataset.name = name;

            if (c) {
                const age = now - new Date(c.last_report).getTime();
                const barColor = age < threshold ? "#28a745" : "#dc3545";
                card.dataset.server = c.server;
                card.dataset.dia = c.dia;
                card.style.borderLeftColor = barColor;

                const newCardHTML = getCondensed()
                    ? `
                        <input type="checkbox" class="card-checkbox" onchange="toggleCardByCheckbox(this, '${c.name}')">
                        <div class="name">${c.name}</div>
                        <div class="info">${c.server}<br>${c.dia}</div>
                    `
                    : `
                        <input type="checkbox" class="card-checkbox" onchange="toggleCardByCheckbox(this, '${c.name}')">
                        <div class="name">${c.name}</div>
                        <div class="info">
                            ${c.ip}<br>
                            ${c.game} (${c.server})<br>
                            ${c.dia}<br>
                            ${c.status.toUpperCase()}<br>
                            ${trimTimestamp(c.last_report)}
                        </div>
                    `;

                console.log('🆕 신규 카드 HTML 생성:', c.name, newCardHTML.includes('checkbox'));
                card.innerHTML = newCardHTML;
            } else {
                card.dataset.server = "";
                // 빈 카드에 숫자 표시 (empty-123 형태에서 숫자 추출)
                const emptyNumber = name.match(/empty-(\d+)/)?.[1] || '';
                const displayName = emptyNumber ? `빈자리 ${emptyNumber}` : name;

                card.innerHTML = `
                    <div class="delete-btn" onclick="deleteCard('${name}')">삭제</div>
                    <div class="name">${displayName}</div>
                    <div class="info">[미동작 자리]</div>
                `;
            }

            // 카드 클릭 이벤트는 main.js에서 전역으로 처리

            grid.appendChild(card);
        });

        // 5) Sortable 활성화 (드래그 앤 드롭)
        if (typeof Sortable !== 'undefined') {
            // 기존 Sortable 인스턴스가 있으면 제거
            if (grid._sortable) {
                grid._sortable.destroy();
                grid._sortable = null;
            }

            let originalOrder = [];

            grid._sortable = Sortable.create(grid, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                swap: true, // Enable swap plugin for true swap behavior
                swapClass: 'sortable-swap-highlight', // Class for swap target highlighting
                onEnd: function (evt) {
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;

                    console.log('스왑:', oldIndex, '↔', newIndex);

                    // 같은 위치면 아무것도 하지 않음
                    if (oldIndex === newIndex) {
                        return;
                    }

                    // 현재 클라이언트 순서 가져오기
                    const currentOrder = getClientOrder().slice();
                    console.log('스왑 전 순서:', currentOrder[oldIndex], 'vs', currentOrder[newIndex]);

                    // 두 위치의 값만 교체 (순수 스왑)
                    const temp = currentOrder[oldIndex];
                    currentOrder[oldIndex] = currentOrder[newIndex];
                    currentOrder[newIndex] = temp;

                    console.log('스왑 후:', currentOrder[oldIndex], '↔', currentOrder[newIndex]);

                    // 교체된 순서 저장
                    setClientOrder(currentOrder);

                    // UI 새로고침 (스왑 플러그인이 이미 DOM을 올바르게 변경했으므로 더 빠름)
                    fetchClients();
                }
            });
        }

        // 6) 필터 적용
        applyFilters();

        // 7) 줄 체크박스 정확한 위치에 배치 (카드 렌더링 완료 대기)
        setTimeout(() => {
            // 다시 한번 카드 높이가 제대로 계산됐는지 확인
            requestAnimationFrame(() => {
            const cards = grid.querySelectorAll('.card'); // 빈 카드도 포함
            const totalRows = Math.ceil(cards.length / 20);
            console.log('🟢 줄 체크박스 생성 시작 - 총 카드:', cards.length, '총 행:', totalRows);

            // 기존 줄 체크박스와 라벨 제거 (모든 타입)
            document.querySelectorAll('.row-checkbox').forEach(cb => cb.remove());
            document.querySelectorAll('.row-label').forEach(lb => lb.remove());
            document.querySelectorAll('.row-checkbox-custom').forEach(cb => cb.remove());

            for (let row = 0; row < totalRows; row++) {
                const firstCardInRow = cards[row * 20];
                if (firstCardInRow) {
                    // 커스텀 체크박스 컨테이너 생성
                    const rowCheckboxContainer = document.createElement('div');
                    rowCheckboxContainer.id = `row-checkbox-${row}`;
                    rowCheckboxContainer.className = 'row-checkbox-custom';
                    rowCheckboxContainer.style.position = 'absolute';
                    rowCheckboxContainer.style.left = (firstCardInRow.offsetLeft - 25) + 'px';

                    // 해당 줄의 모든 카드 중 가장 높은 카드 기준으로 중앙 배치
                    const startIndex = row * 20;
                    const endIndex = Math.min(startIndex + 20, cards.length);
                    const rowCards = Array.from(cards).slice(startIndex, endIndex);

                    // 단순하게 첫 번째 카드 기준으로 하되 줄의 최대 높이 사용
                    let maxHeight = 0;
                    rowCards.forEach(card => {
                        if (card.offsetHeight > maxHeight) {
                            maxHeight = card.offsetHeight;
                        }
                    });

                    // 첫 번째 카드 위치 + 최대 높이 기준으로 중앙 계산
                    const checkboxHeight = 24;
                    const centerOffset = (maxHeight - checkboxHeight) / 2;
                    rowCheckboxContainer.style.top = (firstCardInRow.offsetTop + centerOffset) + 'px';

                    console.log(`줄 ${row}: 카드수=${rowCards.length}, 최대높이=${maxHeight}, 첫카드위치=${firstCardInRow.offsetTop}, 최종위치=${firstCardInRow.offsetTop + centerOffset}`);

                    rowCheckboxContainer.style.width = '24px';
                    rowCheckboxContainer.style.height = '24px';
                    rowCheckboxContainer.style.border = '2px solid #007bff';
                    rowCheckboxContainer.style.borderRadius = '4px';
                    rowCheckboxContainer.style.backgroundColor = '#fff';
                    rowCheckboxContainer.style.cursor = 'pointer';
                    rowCheckboxContainer.style.display = 'flex';
                    rowCheckboxContainer.style.alignItems = 'center';
                    rowCheckboxContainer.style.justifyContent = 'center';
                    rowCheckboxContainer.style.fontSize = '10px';
                    rowCheckboxContainer.style.fontWeight = 'bold';
                    rowCheckboxContainer.style.color = '#007bff';
                    rowCheckboxContainer.style.zIndex = '100';
                    rowCheckboxContainer.style.transition = 'all 0.2s';

                    // 숫자 텍스트 추가
                    rowCheckboxContainer.textContent = String(row + 1).padStart(2, '0');

                    // 체크 상태 저장
                    rowCheckboxContainer.dataset.checked = 'false';

                    // 클릭 이벤트
                    rowCheckboxContainer.onclick = () => {
                        const isChecked = rowCheckboxContainer.dataset.checked === 'true';
                        rowCheckboxContainer.dataset.checked = !isChecked;

                        if (!isChecked) {
                            // 체크됨
                            rowCheckboxContainer.style.backgroundColor = '#007bff';
                            rowCheckboxContainer.style.color = '#fff';
                            rowCheckboxContainer.style.transform = 'scale(1.1)';
                        } else {
                            // 체크 해제
                            rowCheckboxContainer.style.backgroundColor = '#fff';
                            rowCheckboxContainer.style.color = '#007bff';
                            rowCheckboxContainer.style.transform = 'scale(1)';
                        }

                        toggleRowSelection(row);
                    };

                    document.body.appendChild(rowCheckboxContainer);

                    console.log(`✅ 줄 체크박스 ${row} 생성됨 - 위치: left=${rowCheckboxContainer.style.left}, top=${rowCheckboxContainer.style.top}`);
                }
            }
            console.log('🟢 줄 체크박스 생성 완료');
            });
        }, 300);

        // 8) 순서 저장
        setClientOrder(names);

        return data;
    } catch (err) {
        console.error("❌ fetchClients 에러:", err);
        showErrorMessage?.('클라이언트 데이터를 불러오는데 실패했습니다: ' + err.message);
    }
}

// 서버 상태 확인 함수
async function checkServerStatus() {
    try {
        const response = await fetch(getApiUrl('/api/server-status'));
        const status = await response.json();

        // 메인 서버 상태 업데이트
        const mainServerDot = document.querySelector('#mainServerStatus span');
        const webServerDot = document.querySelector('#webServerStatus span');

        if (mainServerDot) {
            mainServerDot.style.background = status.main_server ? '#28a745' : '#dc3545';
        }
        if (webServerDot) {
            webServerDot.style.background = status.web_server ? '#28a745' : '#dc3545';
        }

        return status;
    } catch (error) {
        console.error('서버 상태 확인 실패:', error);
        // 에러 발생 시 빨간색으로 표시
        const mainServerDot = document.querySelector('#mainServerStatus span');
        const webServerDot = document.querySelector('#webServerStatus span');
        if (mainServerDot) mainServerDot.style.background = '#dc3545';
        if (webServerDot) webServerDot.style.background = '#dc3545';
        return null;
    }
}

// 서버 클릭 핸들러
async function handleServerClick(serverType) {
    try {
        // 현재 상태 확인
        const statusResponse = await fetch(getApiUrl('/api/server-status'));
        const status = await statusResponse.json();

        let isRunning = false;
        if (serverType === 'main') {
            isRunning = status.main_server;
        } else if (serverType === 'web') {
            isRunning = status.web_server;
        }

        if (!isRunning) {
            const confirmed = confirm(`${serverType === 'main' ? '메인' : '웹'} 서버를 시작하시겠습니까?`);
            if (!confirmed) return;

            const response = await fetch(getApiUrl('/api/start-server'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: serverType
                })
            });

            const result = await response.json();
            alert(result.message);

            // 상태 새로고침
            setTimeout(() => {
                checkServerStatus();
            }, 2000);
        } else {
            alert(`${serverType === 'main' ? '메인' : '웹'} 서버가 이미 실행 중입니다.`);
        }
    } catch (error) {
        console.error('서버 클릭 처리 실패:', error);
        alert('서버 상태 확인에 실패했습니다.');
    }
}

// INI 명령 전송
async function sendIniCommand() {
    const targets = getTargetClients();
    const iniContent = document.getElementById('iniContent').value.trim();

    if (targets.length === 0) {
        alert('전송할 클라이언트가 선택되지 않았습니다.');
        return;
    }

    if (!iniContent) {
        alert('INI 명령 내용이 비어있습니다.');
        return;
    }

    // 로딩 표시
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    loadingOverlay.style.display = 'flex';
    loadingMessage.textContent = '전송 중...';

    addLog(`전송 시작: ${targets.length}개 클라이언트`);

    try {
        // Flask API로 전송
        const response = await fetch(getApiUrl('/api/send-ini'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                clients: targets,
                ini_content: iniContent
            })
        });

        const result = await response.json();

        if (result.success) {
            addLog(`✅ ${result.message}`, 'success');

            if (result.success_clients && result.success_clients.length > 0) {
                addLog(`성공: ${result.success_clients.join(', ')}`, 'success');
            }

            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    addLog(`❌ ${error}`, 'error');
                });
            }
        } else {
            addLog(`❌ ${result.message}`, 'error');
        }

    } catch (error) {
        console.error('전송 실패:', error);
        addLog(`❌ 전송 실패: ${error.message}`, 'error');
    } finally {
        loadingOverlay.style.display = 'none';
    }
}