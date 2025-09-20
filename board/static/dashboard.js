
function generateSparkline(values) {
  const blocks = "▁▂▃▄▅▆▇█";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map(val => {
    const level = Math.floor(((val - min) / range) * (blocks.length - 1));
    return blocks[level];
  }).join('');
}

// ✅ 상태값
let condensed = false;
let serverFilter = null;

// INI 명령 전송 관련 전역 변수 추가
let selectedClients = new Set();
let isCommandModalOpen = false;
let customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '{}');
let currentEditingTemplate = null;

// ✅ 유틸 함수
function trimTimestamp(ts) {
    return ts.replace(/^20\d\d-/, '');
}

function getThresholdMs() {
    // 갱신 간격을 상태 체크 기준으로 사용
    const refreshInterval = getRefreshInterval(); // 초 단위
    return refreshInterval * 1000; // 밀리초로 변환
}

function setServerFilter(name) {
    serverFilter = name === '__ALL__' ? null : name;
    fetchClients();
}

// ✅ UI 이벤트 핸들러
function toggleCondensed() {
    condensed = !condensed;
    document.getElementById("toggle-btn").textContent = condensed ? "전체 모드" : "간결 모드";
    fetchClients();
}

/*
// ✅ 서버 요약 정보 출력
function updateServerSummary(data) {
    const summary = {};
    data.forEach(c => {
        if (!c.server) return;
        summary[c.server] = (summary[c.server] || 0) + Number(c.dia || 0);
    });

    const serverLinks = Object.entries(summary).map(([server, total]) => {
        const active = server === serverFilter ? 'active' : '';
        return `<span class="${active}" onclick="setServerFilter('${server}')">${server}: ${total}</span>`;
    }).join(' | ');

    const allLink = `<span class="${!serverFilter ? 'active' : ''}" onclick="setServerFilter('__ALL__')">전체 보기</span>`;

    const historyBtn = `<button onclick="location.href='../static/dia-history.html'" style="font-size: 0.8em; padding: 2px 6px; margin-left: 6px;">📅 추적</button>`;
    //const historyBtn = `<button onclick="showDiaHistory()" style="font-size: 0.8em; padding: 2px 6px; margin-left: 6px;">📅 추적</button>`;

    const html = `다이아 합산 → ${serverLinks} | ${allLink} ${historyBtn}`;

    document.getElementById("serverSummary").innerHTML = html;
}
*/

// ✅ 서버 요약 정보 출력 (카드보드 & 다이아보드 공용)
function updateServerSummary(data) {
    // 1) 서버별 다이아 합계 계산
    const summary = {};
    data.forEach(c => {
        if (!c.server) return;
        summary[c.server] = (summary[c.server] || 0) + Number(c.dia || 0);
    });

    // 2) 서버별 링크(필터) 생성
    const serverLinks = Object.entries(summary)
        .map(([server, total]) => {
            const active = server === serverFilter ? 'active' : '';
            return `<span class="${active}"
                    onclick="setServerFilter('${server}')">
                ${server}: ${total.toLocaleString()}
              </span>`;
        })
        .join(' | ');

    // 3) 페이지 구분: 다이아보드인지 여부 판단
    const isDiaBoard = location.pathname.includes('dia-history');

    // 4) 카드보드 전용 “전체 보기” 링크
    const allLink = `<span class="${!serverFilter ? 'active' : ''}"
                         onclick="setServerFilter('__ALL__')">
                     전체 보기
                   </span>`;

    // 5) 버튼 라벨·이동경로 설정
    //    - 카드보드: “📅 추적” → 다이아보드로
    //    - 다이아보드: “📺 모니터” → 카드보드 루트로
    const btnLabel = isDiaBoard ? '모니터' : '추적';
    const btnIcon = isDiaBoard ? '📺' : '📅';
    const btnHref = isDiaBoard ? '/' : '/static/dia-history.html';
    const historyBtn = `<button onclick="location.href='${btnHref}'" class="gray-btn" style="margin-left:6px;">
                            ${btnLabel}
                          </button>`;

    // 6) 최종 HTML 조립
    //    - 카드보드: serverLinks | allLink + historyBtn
    //    - 다이아보드: serverLinks + historyBtn
    const html = isDiaBoard
        ? `다이아 합산 → ${serverLinks} ${historyBtn}`
        : `다이아 합산 → ${serverLinks} | ${allLink} ${historyBtn}`;

    // 7) DOM에 반영
    document.getElementById("serverSummary").innerHTML = html;
}

function getClientOrder() {
    return JSON.parse(localStorage.getItem("clientOrder") || "[]");
}

function setClientOrder(order) {
    localStorage.setItem("clientOrder", JSON.stringify(order));
}

// 갱신 간격 관련 함수들
let refreshIntervalId = null;
let progressInterval = null;

function getRefreshInterval() {
    return parseInt(localStorage.getItem("refreshInterval") || "60"); // 기본값 60초
}

function setRefreshInterval(seconds) {
    localStorage.setItem("refreshInterval", seconds.toString());

    // 기존 interval 제거
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
    }
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    // 새 interval 설정
    refreshIntervalId = setInterval(() => {
        startProgressAnimation(seconds);
        fetchClients();
    }, seconds * 1000);

    // 버튼 상태 업데이트
    updateRefreshButtons(seconds);

    // 새로운 간격으로 즉시 진행률 바 시작
    startProgressAnimation(seconds);

    // 상태 체크 기준이 변경되었으므로 카드 상태 즉시 업데이트
    fetchClients();

    console.log(`갱신 간격이 ${seconds}초로 설정되었습니다. (상태 체크 기준도 ${seconds}초로 변경)`);
}

function startProgressAnimation(totalSeconds) {
    const progressBar = document.getElementById('refreshProgressBar');
    if (!progressBar) return;

    let elapsed = 0;
    const updateInterval = 100; // 0.1초마다 업데이트

    // 이전 진행 애니메이션 정리
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    progressBar.style.width = '0%';

    progressInterval = setInterval(() => {
        elapsed += updateInterval;
        const progress = (elapsed / (totalSeconds * 1000)) * 100;

        if (progress >= 100) {
            progressBar.style.width = '100%';
            clearInterval(progressInterval);
            // 잠깐 후 0%로 리셋
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 100);
        } else {
            progressBar.style.width = progress + '%';
        }
    }, updateInterval);
}

function updateRefreshButtons(activeInterval) {
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.interval) === activeInterval) {
            btn.classList.add('active');
        }
    });
}

function initializeRefreshInterval() {
    const interval = getRefreshInterval();
    setRefreshInterval(interval);
    // 첫 로드 후 바로 진행률 바 시작
    startProgressAnimation(interval);
}

//SQLite 데이터 처리
async function fetchClients() {
    const threshold = getThresholdMs();
    const now = Date.now();
    const clientOrder = getClientOrder();

    try {
        // 1) 데이터 가져오기
        const res = await fetch("/api/clients");
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
        const orderedNames = clientOrder.filter(name => allNames.includes(name) || !clientMap[name]); // 기존 순서 유지 (빈 카드 포함)
        const newNames = allNames.filter(name => !clientOrder.includes(name)); // 새 클라이언트
        const names = [...orderedNames, ...newNames]; // 기존 + 새 클라이언트

        // 4) 카드 생성·업데이트
        names.forEach((name, index) => {
            const existing = grid.querySelector(`.card[data-name="${name}"]`);
            const c = clientMap[name];
             // 4-1) 이미 있으면 업데이트만
            if (existing) {
                const c = clientMap[name];
                if (c && !existing.classList.contains("empty")) {
                    // 기존 체크박스 상태 저장
                    const existingCheckbox = existing.querySelector('.card-checkbox');
                    const isChecked = existingCheckbox ? existingCheckbox.checked : false;

                    existing.innerHTML = condensed
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
                }
                return;
            }

            // 4-2) 새 카드 생성
            //const c = clientMap[name];
            const card = document.createElement("div");
            card.className = c ? "card" : "card empty";
            card.dataset.name = name;
            if (c) {
                const age = now - new Date(c.last_report).getTime();
                const barColor = age < threshold ? "#28a745" : "#dc3545";
                card.dataset.server = c.server;
                card.dataset.dia = c.dia;  // ✅ 추가된 줄
                card.style.borderLeftColor = barColor;

                card.innerHTML = condensed
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
            } else {
                card.dataset.server = "";
                card.innerHTML = `
          <div class="delete-btn" onclick="deleteCard('${name}')">삭제</div>
          <div class="name">${name}</div>
          <div class="info">[미동작 자리]</div>
        `;
            }

            grid.appendChild(card);
        });

        // 5) 줄 체크박스 정확한 위치에 배치
        setTimeout(() => {
            const cards = grid.querySelectorAll('.card'); // 빈 카드도 포함
            const totalRows = Math.ceil(cards.length / 20);

            // 기존 줄 체크박스 제거
            document.querySelectorAll('.row-checkbox').forEach(cb => cb.remove());

            for (let row = 0; row < totalRows; row++) {
                const firstCardInRow = cards[row * 20];
                if (firstCardInRow) {
                    const rect = firstCardInRow.getBoundingClientRect();
                    const rowCheckbox = document.createElement('input');
                    rowCheckbox.type = 'checkbox';
                    rowCheckbox.id = `row-checkbox-${row}`;
                    rowCheckbox.className = 'row-checkbox';
                    rowCheckbox.style.position = 'absolute';
                    rowCheckbox.style.left = (firstCardInRow.offsetLeft - 20) + 'px';

                    // 카드 높이의 중앙에 배치
                    const cardHeight = firstCardInRow.offsetHeight;
                    const checkboxHeight = 16; // 체크박스 기본 높이
                    const centerOffset = (cardHeight - checkboxHeight) / 2;
                    rowCheckbox.style.top = (firstCardInRow.offsetTop + centerOffset) + 'px';

                    rowCheckbox.style.zIndex = '100';
                    rowCheckbox.onchange = () => toggleRowSelection(row);
                    document.body.appendChild(rowCheckbox);
                }
            }
        }, 100);

        // 6) Sortable 초기화 (중복 방지)
        if (typeof Sortable !== "undefined") {
            if (grid._sortableInstance) {
                grid._sortableInstance.destroy();
            }
            grid._sortableInstance = Sortable.create(grid, {
                animation: 150,
                swap: true,
                swapClass: "highlight",
                onEnd: () => {
                    const newOrder = Array.from(grid.children)
                        .map(c => c.dataset.name);
                    setClientOrder(newOrder);
                }
            });
        } else {
            console.warn("❗ Sortable 초기화 실패 – 라이브러리가 로드되지 않았습니다.");
        }

        // 6) 필터 적용
        applyFilters();

        // INI 명령 시스템 초기화 추가
        initializeCommandSystem();

        // 서버 상태 확인 시작
        checkServerStatus();
        setInterval(checkServerStatus, 5000); // 5초마다 확인

    } catch (err) {
        console.error("fetchClients 중 예외 발생:", err);
    }
}

// 다이아 범위 모드 상태
let isDiaRangeMode = false;

// 다이아 범위 모드 토글
function toggleDiaRange() {
    isDiaRangeMode = !isDiaRangeMode;

    const maxInput = document.getElementById("maxDiaInput");
    const rangeIndicator = document.getElementById("rangeIndicator");
    const minInput = document.getElementById("minDiaInput");
    const toggleBtn = document.getElementById("rangeToggle");

    if (isDiaRangeMode) {
        // 범위 모드 활성화
        maxInput.style.display = "";
        rangeIndicator.style.display = "";
        minInput.placeholder = "최소";
        toggleBtn.textContent = "≥";
        toggleBtn.style.background = "#e3f2fd";
        toggleBtn.style.color = "#1976d2";
    } else {
        // 기본 모드 (이상 검색)
        maxInput.style.display = "none";
        rangeIndicator.style.display = "none";
        minInput.placeholder = "다이아 ≥";
        toggleBtn.textContent = "범위";
        toggleBtn.style.background = "#f8f9fa";
        toggleBtn.style.color = "#666";

        // 최대값 입력 초기화
        maxInput.value = "";
    }

    applyFilters();
}

//다이아필터링함수
function applyFilters() {
    const q = document.getElementById("searchInput")?.value.trim().toLowerCase();
    const minDia = parseInt(document.getElementById("minDiaInput")?.value || "0");
    const maxDia = parseInt(document.getElementById("maxDiaInput")?.value || "999999999");
    const server = serverFilter;

    document.querySelectorAll(".card").forEach(card => {
        const isEmpty = card.classList.contains("empty");
        const serverName = card.dataset.server || "";
        const fullText = card.textContent.toLowerCase();

        const matchesText = !q || fullText.includes(q);
        const matchesServer = !server || isEmpty || serverName === server;

        let matchesDia = true;

        if (!isEmpty && (minDia > 0 || isDiaRangeMode)) {
            const diaValue = parseInt(card.dataset.dia || "0");

            if (isDiaRangeMode) {
                // 범위 모드: 최소값 이상 AND 최대값 이하
                const hasMin = minDia > 0;
                const hasMax = maxDia < 999999999;

                if (hasMin && hasMax) {
                    matchesDia = !isNaN(diaValue) && diaValue >= minDia && diaValue <= maxDia;
                } else if (hasMin) {
                    matchesDia = !isNaN(diaValue) && diaValue >= minDia;
                } else if (hasMax) {
                    matchesDia = !isNaN(diaValue) && diaValue <= maxDia;
                } else {
                    matchesDia = true;
                }
            } else {
                // 기본 모드: 최소값 이상
                matchesDia = !isNaN(diaValue) && diaValue >= minDia;
            }
        }

        card.classList.remove("ghost-card");
        card.style.display = "";

        // 모든 조건을 검사해서 하나라도 맞지 않으면 ghost 처리
        const shouldGhost = !matchesText || !matchesServer || !matchesDia;
        if (shouldGhost) {
            card.classList.add("ghost-card");
        }
    });
}


function addEmptyCard() {
    let name = prompt("빈 카드 이름 입력")?.trim();
    if (!name) name = `empty-${Date.now()}`;

    const order = getClientOrder();
    order.push(name);
    setClientOrder(order);
    fetchClients();
}

// 번호순 자동 정렬 함수 (320개 자리, 세로 배치)
function autoSortByNumbers() {
    // 확인 팝업
    const confirmed = confirm("번호순 자동 정렬을 실행하시겠습니까?\n\n⚠️ 주의: 현재 카드 배치가 모두 변경됩니다.");
    if (!confirmed) {
        return; // 취소하면 함수 종료
    }
    const grid = document.getElementById("dashboard");
    const cards = Array.from(grid.querySelectorAll('.card[data-name]'));

    // 진짜 카드 정보 수집 (빈 카드 제외)
    const realCardInfo = {};
    const duplicateCards = []; // 중복 번호 카드들

    cards.forEach(card => {
        const name = card.dataset.name;
        if (!name.startsWith('empty-')) { // 빈 카드가 아닌 경우만
            // 모든 숫자를 추출하고 앞의 0을 제거 (영문 무시)
            const numbers = name.match(/\d+/g);
            if (numbers && numbers.length > 0) {
                // 가장 긴 숫자 그룹을 사용하거나 마지막 숫자 그룹을 사용
                const lastNumber = numbers[numbers.length - 1];
                const number = parseInt(lastNumber); // parseInt는 자동으로 앞의 0을 제거

                if (realCardInfo[number]) {
                    // 이미 같은 번호가 있으면 중복 리스트에 추가
                    duplicateCards.push(name);
                } else {
                    // 처음 나온 번호면 정상 위치에 배치
                    realCardInfo[number] = name;
                }
            }
        }
    });

    // 실제 존재하는 카드들의 번호 범위 확인
    const realNumbers = Object.keys(realCardInfo).map(n => parseInt(n)).sort((a,b) => a-b);
    const maxNumber = realNumbers.length > 0 ? Math.max(...realNumbers) : 20;

    console.log(`실제 카드들의 번호:`, realNumbers);
    console.log(`최대 번호: ${maxNumber}`);

    // 적절한 그리드 크기 계산 (최대 번호의 1.2배 정도로 여유공간 확보)
    const columnsPerRow = 20;
    const suggestedSlots = Math.min(320, Math.ceil(maxNumber * 1.2 / columnsPerRow) * columnsPerRow);
    const totalSlots = suggestedSlots;

    console.log(`조정된 총 슬롯 수: ${totalSlots}`);

    // 세로 배치로 자리 생성 (컬럼별로 1-20 순서)
    const sortedOrder = [];
    const totalColumns = Math.ceil(totalSlots / columnsPerRow);
    let emptyCardCounter = 1;

    for (let col = 0; col < totalColumns; col++) {
        for (let row = 1; row <= columnsPerRow; row++) {
            const number = row + (col * columnsPerRow);
            if (number > totalSlots) break;

            if (realCardInfo[number]) {
                // 진짜 카드가 있으면 사용
                sortedOrder.push(realCardInfo[number]);
            } else {
                // 없으면 순서에 상관없는 빈 카드
                sortedOrder.push(`empty-${emptyCardCounter++}`);
            }
        }
    }

    // 중복 카드들을 맨 아래에 추가
    duplicateCards.forEach(duplicateName => {
        sortedOrder.push(duplicateName);
    });

    console.log(`생성된 총 카드 수: ${sortedOrder.length} (320개 그리드 + ${duplicateCards.length}개 중복카드)`);
    console.log(`중복 카드들: ${duplicateCards.length}개 - `, duplicateCards);

    // 순서 저장 및 강제 새로고침
    setClientOrder(sortedOrder);

    console.log(`자동정렬 완료. 진짜 카드: ${Object.keys(realCardInfo).length}개, 중복: ${duplicateCards.length}개`);
    console.log("첫 줄 (1-20위치):", sortedOrder.slice(0, 20));

    // 즉시 페이지 새로고침하여 정렬 반영
    location.reload();
}

function deleteCard(name) {
    // 빈 카드만 삭제 가능
    if (!name.startsWith('empty-')) {
        alert("진짜 카드는 삭제할 수 없습니다!");
        return;
    }

    const order = getClientOrder();
    const newOrder = order.filter(cardName => cardName !== name);
    setClientOrder(newOrder);
    fetchClients();

    console.log(`빈 카드 삭제: ${name}`);
}

// 선택된 줄 삭제 (기존 줄 체크박스 시스템 활용)
function deleteSelectedRows() {
    console.log("=== 줄별 삭제 시작 ===");

    // 기존 줄 체크박스들 중 체크된 것들 찾기
    const checkedRowCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    console.log("체크된 줄 체크박스 개수:", checkedRowCheckboxes.length);
    console.log("체크된 체크박스 ID들:", Array.from(checkedRowCheckboxes).map(cb => cb.id));

    if (checkedRowCheckboxes.length === 0) {
        alert('삭제할 줄을 선택해주세요.\n\n줄 왼쪽의 체크박스를 선택하세요.');
        return;
    }

    // 현재 카드 순서 가져오기
    const order = getClientOrder();
    console.log("현재 카드 순서:", order.length, "개");

    // 선택된 줄들 중 진짜 카드가 있는 줄 체크
    const safeRowsToDelete = [];
    const blockedRows = [];

    checkedRowCheckboxes.forEach(checkbox => {
        const rowMatch = checkbox.id.match(/row-checkbox-(\d+)/);
        if (rowMatch) {
            const rowNum = parseInt(rowMatch[1]) + 1; // 0-based를 1-based로 변환
            const startIndex = rowNum === 1 ? 0 : (rowNum - 1) * 20;
            const endIndex = Math.min(startIndex + 20, order.length);

            console.log(`${rowNum}번째 줄 확인: 인덱스 ${startIndex}-${endIndex-1}`);

            // 해당 줄에 진짜 카드가 있는지 확인
            let hasRealCard = false;
            const rowCards = [];
            for (let i = startIndex; i < endIndex; i++) {
                if (order[i]) {
                    rowCards.push(order[i]);
                    if (!order[i].startsWith('empty-')) {
                        hasRealCard = true;
                    }
                }
            }

            console.log(`${rowNum}번째 줄 카드들:`, rowCards);
            console.log(`${rowNum}번째 줄 진짜 카드 있음:`, hasRealCard);

            if (hasRealCard) {
                blockedRows.push(rowNum);
            } else {
                safeRowsToDelete.push(rowNum);
            }
        }
    });

    console.log("차단된 줄들:", blockedRows);
    console.log("삭제 가능한 줄들:", safeRowsToDelete);

    // 진짜 카드가 있는 줄이 선택되었으면 경고
    if (blockedRows.length > 0) {
        alert(`⚠️ 삭제 불가능한 줄이 있습니다.\n\n${blockedRows.join(', ')}번째 줄에는 진짜 카드가 포함되어 있어 삭제할 수 없습니다.\n\n빈카드만 있는 줄만 선택해주세요.`);
        return;
    }

    // 안전한 줄만 삭제 확인
    if (safeRowsToDelete.length === 0) {
        alert('삭제할 수 있는 줄이 없습니다.');
        return;
    }

    const confirmed = confirm(`${safeRowsToDelete.length}개 줄의 빈카드들을 모두 삭제하시겠습니까?\n\n삭제 대상: ${safeRowsToDelete.join(', ')}번째 줄`);
    if (!confirmed) return;

    // 안전한 줄들의 빈카드들만 제거
    const cardsToDelete = [];
    safeRowsToDelete.forEach(rowNum => {
        const startIndex = rowNum === 1 ? 0 : (rowNum - 1) * 20;
        const endIndex = Math.min(startIndex + 20, order.length);

        for (let i = startIndex; i < endIndex; i++) {
            if (order[i] && order[i].startsWith('empty-')) {
                cardsToDelete.push(order[i]);
                console.log(`삭제 예정: ${order[i]}`);
            }
        }
    });

    console.log("삭제할 카드들:", cardsToDelete);

    // 빈카드들 제거
    const newOrder = order.filter(cardName => !cardsToDelete.includes(cardName));
    console.log("삭제 후 순서:", newOrder.length, "개");

    setClientOrder(newOrder);

    // 체크박스 해제
    checkedRowCheckboxes.forEach(cb => cb.checked = false);

    // 즉시 새로고침
    console.log("새로고침 실행");
    location.reload();
}

// 서버 상태 확인 함수
async function checkServerStatus() {
    try {
        const response = await fetch('/api/server-status');
        const status = await response.json();

        // 메인 서버 상태 업데이트
        const mainServerDot = document.querySelector('#mainServerStatus span');
        const mainServerStatus = document.getElementById('mainServerStatus');
        if (status.main_server) {
            mainServerDot.style.background = '#28a745'; // 초록색 (정상)
            mainServerDot.title = `메인 서버 실행중 (포트 ${status.main_server_port})`;
            mainServerStatus.style.cursor = 'default';
            mainServerStatus.title = `메인 서버 실행중 (포트 ${status.main_server_port})`;
        } else {
            mainServerDot.style.background = '#dc3545'; // 빨간색 (중지)
            mainServerDot.title = `메인 서버 중지됨 - 클릭하여 시작`;
            mainServerStatus.style.cursor = 'pointer';
            mainServerStatus.title = `메인 서버 중지됨 - 클릭하여 시작 (포트 ${status.main_server_port})`;
        }

        // 웹 서버 상태 업데이트
        const webServerDot = document.querySelector('#webServerStatus span');
        const webServerStatus = document.getElementById('webServerStatus');
        if (status.web_server) {
            webServerDot.style.background = '#28a745'; // 초록색 (정상)
            webServerDot.title = `웹 서버 실행중 (포트 ${status.web_server_port})`;
            webServerStatus.style.cursor = 'default';
            webServerStatus.title = `웹 서버 실행중 (포트 ${status.web_server_port})`;
        } else {
            webServerDot.style.background = '#dc3545'; // 빨간색 (중지)
            webServerDot.title = `웹 서버 중지됨 - 클릭하여 시작`;
            webServerStatus.style.cursor = 'pointer';
            webServerStatus.title = `웹 서버 중지됨 - 클릭하여 시작 (포트 ${status.web_server_port})`;
        }

        // 프로세스 정보 추가 (옵션)
        if (status.processes && status.processes.length > 0) {
            const processInfo = status.processes.map(p => `${p.name} (PID: ${p.pid})`).join('\n');
            document.getElementById('serverStatus').title = `실행중인 프로세스:\n${processInfo}`;
        }

    } catch (error) {
        console.error('서버 상태 확인 실패:', error);
        // 에러 시 모든 상태를 중지로 표시
        document.querySelectorAll('#serverStatus span span').forEach(dot => {
            dot.style.background = '#ffc107'; // 노란색 (알 수 없음)
            dot.title = '상태 확인 실패';
        });
    }
}

// 서버 클릭 핸들러
async function handleServerClick(serverType) {
    try {
        // 현재 상태 확인
        const statusResponse = await fetch('/api/server-status');
        const status = await statusResponse.json();

        let isRunning = false;
        if (serverType === 'main') {
            isRunning = status.main_server;
        } else if (serverType === 'web') {
            isRunning = status.web_server;
        }

        // 서버가 중지되어 있을 때만 시작
        if (!isRunning) {
            const confirmed = confirm(`${serverType === 'main' ? '메인' : '웹'} 서버를 시작하시겠습니까?`);
            if (!confirmed) return;

            const response = await fetch('/api/start-server', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: serverType })
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                // 3초 후 상태 다시 확인
                setTimeout(checkServerStatus, 3000);
            } else {
                alert('서버 시작 실패: ' + result.message);
            }
        } else {
            // 이미 실행중일 때
            alert(`${serverType === 'main' ? '메인' : '웹'} 서버는 이미 실행중입니다.`);
        }

    } catch (error) {
        console.error('서버 시작 요청 실패:', error);
        alert('서버 시작 요청 중 오류가 발생했습니다.');
    }
}

window.addEventListener("DOMContentLoaded", () => {
    // 1) 대시보드 페이지 초기화 (dashboard.html)
    const dash = document.getElementById("dashboard");
    if (dash) {
        fetchClients();
        initializeRefreshInterval();
        return;
    }

    // 2) 다이아 히스토리 페이지 초기화 (dia-history.html)
    const dia = document.getElementById("diaHistoryContent");
    if (dia) {
        // API에서 7일치 히스토리 데이터 가져오기
        fetch("/api/dia-history?days=7")
            .then(res => res.json())
            .then(stats => {
                console.log("❇️ /api/dia-history 응답:", stats);
                // 로컬스토리지에 저장
                localStorage.setItem("dailyDiaStats", JSON.stringify(stats));

                // 저장된 데이터를 바탕으로 렌더링
                renderDiaHistoryContent(window);
                renderTotalTrendChart(7, window);
                renderServerTrendChart(7, window);

                // 차트 깨짐 방지용 리플로우 트리거
                window.resizeBy(1, 0);
                window.resizeBy(-1, 0);
            })
            .catch(err => {
                console.error("❌ dia-history 데이터 로드 실패:", err);
                document
                    .querySelector("#diaHistoryContent .history-text")
                    .textContent = "❌ 데이터 로드 중 오류가 발생했어요.";
            });
    }


    // 3) 둘 다 해당되지 않으면 아무것도 안 함
});


function formatDiff(curr, prev) {
    const diff = curr - prev;
    if (diff > 0) return `<span class="diff up">🔺 +${diff.toLocaleString()}</span>`;
    if (diff < 0) return `<span class="diff down">🔻 ${diff.toLocaleString()}</span>`;
    return `<span class="diff zero">–</span>`;
}

function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 정규식 이스케이프
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.replace(regex, '<mark>$1</mark>');
}


function renderDiaHistoryContent(win, server = null, name = null) {
    // 1) 함수 호출 여부 확인
    console.log("▶️ renderDiaHistoryContent 호출됨:", win.location.pathname, {server, name});

    // 2) 컨테이너 선택
    const container = win.document.querySelector("#diaHistoryContent .history-text");
    console.log("🔍 container:", container);
    if (!container) {
        console.warn("❌ '.history-text' 요소 없음 – HTML 구조 확인 필요!");
        return;
    }

    // 3) 초기화
    container.innerHTML = "";

    // 4) 저장된 raw 데이터 확인
    const raw = localStorage.getItem("dailyDiaStats");
    console.log("🗄 localStorage[dailyDiaStats]:", raw);
    if (!raw) {
        container.textContent = "❌ 저장된 데이터가 없어요.";
        return;
    }

    // 5) 파싱 & 날짜 키 정렬
    const data = JSON.parse(raw);
    const dates = Object.keys(data).sort().reverse();
    console.log("📅 처리할 날짜 배열:", dates);

    // 6) 스타일 중복 방지
    if (!win.document.getElementById("history-style")) {
        const style = win.document.createElement("style");
        style.id = "history-style";
        style.textContent = `
      .date-group { margin-bottom: 16px; }
      .date-toggle {
        font-weight: bold;
        cursor: pointer;
        padding: 6px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .date-toggle:hover { background: #eaeaea; }
      .date-content.collapsed { display: none; }
      .client-line { margin: 4px 0 4px 8px; font-size: 0.92em; }
      .drop-icon { margin-right: 6px; }
      .highlight-top {
        font-weight: bold;
        color: #d00;
        margin: 4px 0 4px 8px;
        white-space: pre-line;
      }
    `;
        win.document.head.appendChild(style);
    }

    // 7) 날짜별 그룹 렌더링
    for (const date of dates) {
        console.log("⏳ 렌더링 중인 날짜:", date);

        const dayData = data[date];
        const block = win.document.createElement("div");
        block.className = "date-group";

        const toggle = win.document.createElement("div");
        toggle.className = "date-toggle";
        toggle.innerHTML = `<span class="drop-icon">▾</span> ${date}`;
        block.appendChild(toggle);

        const content = win.document.createElement("div");
        content.className = "date-content";

        const isToday = date === new Date().toISOString().slice(0, 10);
        if (!isToday) content.classList.add("collapsed");


        // 클라이언트 필터링
        const clientNames = Object.keys(dayData).filter(
            key => key !== "TOTAL" && key !== "SERVER_SUM" && key !== "COUNT_BY_SERVER"
        );
        const filtered = clientNames.filter(key => {
            const belongsToServer = !server || key.startsWith(server + "-");
            const matchesName = !name || key === name;
            return belongsToServer && matchesName;
        });
        console.log("🔎 filtered clientNames:", filtered);

        // 정렬
        const sorted = filtered.sort((a, b) => {
            const aVal = dayData[a]?.today || 0;
            const bVal = dayData[b]?.today || 0;
            return aVal - bVal;
        });



sorted.forEach(cli => {
  const entry = dayData[cli];
  const group = entry.game || "";         // 예: NC
  const serverName = entry.server || "";  // 예: 테오필
  const val = entry.today ?? 0;
  const diff = entry.diff ?? 0;
  const arrow = diff < 0 ? "🔻" : diff > 0 ? "🔺" : "➖";

    /*
  // 🔹 sparkline 준비 (왼쪽이 오늘데이터)
  const rawVals = dates.slice(0, 14).map(date => {
    const v = data[date]?.[cli]?.today;
    return typeof v === "number" ? v : 0;
  });
  */

  // 🔹 sparkline 준비(오른쪽이 오늘데이터)
  const rawVals = [...dates].sort().slice(-14).map(date => {
  const v = data[date]?.[cli]?.today;
  return typeof v === "number" ? v : 0;
});


  // 🔸 우측 정렬을 위한 앞쪽 padding 처리
  const actualData = rawVals.filter(v => v > 0);
  const padCount = 14 - actualData.length;
  const paddedVals = Array(padCount).fill(0).concat(actualData);

  const spark = paddedVals.every(v => v === 0)
    ? ''
    : generateSparkline(paddedVals);

  const line = win.document.createElement("div");
  line.className = "client-line";
  //line.textContent = `${group} | ${serverName} | ${cli} ${val.toLocaleString()} ${arrow} ${diff.toLocaleString()}   ${spark}`;

line.innerHTML = `
  <span class="text">${group} | ${serverName} | ${cli} ${val.toLocaleString()} ${arrow} ${diff.toLocaleString()}</span>
  <span class="spark">${spark}</span>
`;

  content.appendChild(line);
});





/*
        // 라인 렌더링
        sorted.forEach(cli => {
            const diff = dayData[cli]?.diff ?? 0;
            const val = dayData[cli]?.today ?? 0;
            const arrow = diff < 0 ? "🔻" : diff > 0 ? "🔺" : "➖";
            const line = win.document.createElement("div");
            line.className = "client-line";
            //line.textContent = `${game} | ${server} | ${cli} ${val.toLocaleString()} ${arrow} ${diff.toLocaleString()}   ${spark}`;
            line.textContent = `${cli} ${val.toLocaleString()} ${arrow} ${diff.toLocaleString()}`;

            const entry = dayData[cli];
            const group = entry.game || "";      // 예: NC
            const serverName = entry.server || "";// 예: 테오필
            line.textContent = `${group} | ${serverName} | ${cli} ${val.toLocaleString()} ${arrow} ${diff.toLocaleString()}`;


            content.appendChild(line);
        });
*/




// ✅ TOP 3 상승 (복구된 항목)
        const topRise = sorted
            .filter(k => dayData[k]?.diff > 0)
            .sort((a, b) => dayData[b].diff - dayData[a].diff)
            .slice(0, 3)
            //.map(k => `${k} 🔺 +${dayData[k].diff.toLocaleString()}`);

            .map(k => {
                const info = dayData[k];
                return `${info.game || ''} | ${info.server || ''} | ${k} ${info.today.toLocaleString()} 🔺 +${info.diff.toLocaleString()}`;
            })


        if (topRise.length) {
            const topUpBox = win.document.createElement("div");
            topUpBox.className = "highlight-top";
            topUpBox.innerHTML = `📈 상승 클라 TOP 3<br>${topRise.join("<br>")}`;
            content.appendChild(topUpBox);
        }














// ✅ TOP 3 하락 (기존)
        const topDrop = sorted
            .filter(k => dayData[k]?.diff < 0)
            .slice(0, 3)


            //.map(k => `${k} 🔻 ${dayData[k].diff.toLocaleString()}`);
            .map(k => {
                const info = dayData[k];
                return `${info.game || ''} | ${info.server || ''} | ${k} ${info.today.toLocaleString()} 🔻 ${info.diff.toLocaleString()}`;
            })

        if (topDrop.length) {
            const topBox = win.document.createElement("div");
            topBox.className = "highlight-top";
            topBox.innerHTML = `📉 하락 클라 TOP 3<br>${topDrop.join("<br>")}`;
            content.appendChild(topBox);
        }


        block.appendChild(content);
        container.appendChild(block);

        // 토글 기능
        toggle.addEventListener("click", () => {
            const allBlocks = win.document.querySelectorAll(".date-content");
            allBlocks.forEach(el => el.classList.add("collapsed"));  // 전부 닫기
            content.classList.remove("collapsed");                   // 현재 열기
            toggle.querySelector(".drop-icon").textContent = "▾";    // 드롭 아이콘 열림 표시

            // 아이콘 닫힌 거는 나중에 닫을 때 따로 관리
        });

    }
}

function showDiaHistory() {
    const win = window.open("", "DiaHistoryWindow", "width=1920,height=1080,resizable=yes,scrollbars=yes");
    if (!win) return alert("📦 팝업 차단을 해제해주세요!");
    win.document.title = "📅 다이아 수량 추적 기록";

    // ✅ 스타일만 개선
    win.document.head.innerHTML = `
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: 'Segoe UI', sans-serif;
        background: #fff;
        color: #333;
      }
      .top-bar {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }
      #searchClient {
        padding: 6px;
        font-size: 0.9em;
        width: 240px;
      }
      #suggestList {
        max-height: 120px;
        overflow-y: auto;
        display: none;
        background: #fff;
        border: 1px solid #ccc;
        position: absolute;
        z-index: 100;
        width: 240px;
      }
      #serverFilter {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .layout {
        display: flex;
        gap: 24px;
        align-items: flex-start;
      }
      .history-column {
        flex: 0 0 380px;
        max-height: 720px;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .chart-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 28px;
      }
      .chart-toolbar {
        text-align: center;
        margin-bottom: 8px;
      }
      canvas {
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        display: block;
        margin: auto;
      }
      h1, h2 {
        font-size: 1.2em;
        margin: 16px 0 8px;
        border-bottom: 1px solid #ccc;
        padding-bottom: 4px;
      }
      .suggest-item {
        padding: 4px 6px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      }
      .suggest-item:hover {
        background: #ddd;
      }
    </style>
  `;

    // ✅ 기존 구조 그대로 사용 (디자인만 변경)
    win.document.body.innerHTML = `
    <div class="top-bar">
      <div style="position: relative;">
        <input id="searchClient" placeholder="🔍 클라이언트 검색..." oninput="filterClientName(window)" />
        <div id="suggestList"></div>
      </div>
      <div id="serverFilter"></div>
    </div>

    <div class="layout">
      <div class="history-column">
        <h1>📅 다이아 수량 추적 기록</h1>
        <div id="diaHistoryContent">
          <div class="history-text">⏳ 데이터 불러오는 중...</div>
        </div>
      </div>


      <div class="chart-column">
        <div>
          <h2 style="text-align: center;">📊 TOTAL 추세 그래프</h2>
          <div class="chart-toolbar">
            <button onclick="renderTotalTrendChart(3, window)">최근 3일</button>
            <button onclick="renderTotalTrendChart(7, window)">최근 7일</button>
            <button onclick="renderTotalTrendChart(30, window)">최근 30일</button>
            <button onclick="renderTotalTrendChart(999, window)">전체</button>
          </div>
          <canvas id="totalTrendChart" width="960" height="300"></canvas>
        </div>

        <div>
          <h2 style="text-align: center;">📊 서버별 추세선</h2>
          <div class="chart-toolbar">
            <button onclick="renderServerTrendChart(3, window)">최근 3일</button>
            <button onclick="renderServerTrendChart(7, window)">최근 7일</button>
            <button onclick="renderServerTrendChart(30, window)">최근 30일</button>
            <button onclick="renderServerTrendChart(999, window)">전체</button>
          </div>
          <canvas id="serverTrendChart" width="960" height="300"></canvas>
        </div>
      </div>
    </div>
  `;

    // ✅ 서버 필터 버튼 생성
    const serverDiv = win.document.getElementById("serverFilter");


    if (!localStorage.getItem("dailyDiaStats")) {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('../../server/client_status.db'); // ← 실제 DB 경로로 바꿔줘

        const query = `
            SELECT today.date,
                   today.game,
                   today.server,
                   today.name,
                   today.dia                         AS dia,
                   (today.dia - yesterday.dia)       AS change,
                   today.game || ' ' || today.server AS label
            FROM daily_dia AS today
                     LEFT JOIN daily_dia AS yesterday
                               ON today.name = yesterday.name
                                   AND date (yesterday.date) = date (today.date, '-1 day')
            ORDER BY today.date, today.name;
        `;

        db.all(query, [], (err, rows) => {
            if (err) return console.error("❌ 쿼리 에러:", err);

            if (!rows || rows.length === 0) {
                console.warn("⚠️ SQLite에서 가져온 결과가 없습니다.");
                return;
            }

            console.log("✅ 쿼리 결과 개수:", rows.length);
            console.log("🧾 샘플 데이터:", rows[0]);

            // 날짜별 클라이언트 데이터를 정리
            const grouped = rows.reduce((acc, row) => {
                const {date, name, dia, change} = row;
                if (!acc[date]) acc[date] = {};
                acc[date][name] = {
                    today: dia,
                    diff: change ?? 0
                };
                return acc;
            }, {});

            // 날짜 정렬: 최신 날짜가 맨 뒤로 오도록 정렬해서 저장 (선택사항)
            const sortedDates = Object.keys(grouped).sort();
            const sortedData = {};
            for (const date of sortedDates) {
                sortedData[date] = grouped[date];
            }

            localStorage.setItem("dailyDiaStats", JSON.stringify(sortedData, null, 2));
            console.log("📦 날짜별 데이터 저장 완료!", Object.keys(sortedData));

            win.renderDiaHistoryContent(win); // ✅ 렌더링 호출
        });

        db.close();
        return;
    }


    const raw = localStorage.getItem("dailyDiaStats");
    const diaHistory = JSON.parse(raw || "{}");
    const data = JSON.parse(raw || "{}"); // ✅ 또는 diaHistory로 통일
    const dates = Object.keys(data).sort();

    const serverSet = new Set();

    Object.values(data).forEach(day => {
        Object.keys(day).forEach(name => {
            if (!["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(name)) {
                const server = name.split("-")[0]; // 서버명 추출
                serverSet.add(server);
            }
        });
    });

    // "전체" 버튼
    const allBtn = win.document.createElement("button");
    allBtn.textContent = "전체";
    allBtn.onclick = () => win.renderDiaHistoryContent(win, null);
    serverDiv.appendChild(allBtn);

    Array.from(serverSet).sort().forEach(server => {
        const btn = win.document.createElement("button");
        btn.textContent = server;
        btn.style.marginLeft = "4px";
        btn.onclick = () => win.renderDiaHistoryContent(win, server);
        serverDiv.appendChild(btn);
    });

    // 🔎 추천 리스트 기능 주입 (기존 그대로)
    let selectedIndex = -1;
    win.filterClientName = function (win = window) {
        const inputEl = win.document.getElementById("searchClient");
        if (!inputEl) return;
        const suggestDiv = win.document.getElementById("suggestList");
        if (!suggestDiv) return;

        const input = inputEl.value.trim().toLowerCase();
        const raw = localStorage.getItem("dailyDiaStats");
        if (!raw) return;

        const dataMap = JSON.parse(raw);
        const allNames = new Set();

        Object.values(dataMap).forEach(day => {
            Object.keys(day).forEach(name => {
                if (!["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(name)) {
                    allNames.add(name);
                }
            });
        });

        const matched = Array.from(allNames).filter(name =>
            name.toLowerCase().includes(input)
        ).slice(0, 10);

        suggestDiv.innerHTML = "";
        selectedIndex = -1;

        matched.forEach((name, i) => {
            const div = win.document.createElement("div");
            div.textContent = name;
            div.className = "suggest-item";
            div.style.padding = "4px 6px";
            div.style.cursor = "pointer";
            div.style.borderBottom = "1px solid #eee";
            div.onmouseover = () => highlightItem(i);
            div.onmouseout = () => highlightItem(-1);
            div.onclick = () => {
                inputEl.value = name;
                suggestDiv.style.display = "none";
                win.renderDiaHistoryContent(win, null, name); // ← 검색어(name)를 넘겨줘요!
            };
            suggestDiv.appendChild(div);
        });

        suggestDiv.style.display = matched.length ? "block" : "none";
    };

    setTimeout(() => {
        const input = win.document.getElementById("searchClient");
        const suggestBox = win.document.getElementById("suggestList");

        input.addEventListener("keydown", (e) => {
            const items = suggestBox.querySelectorAll(".suggest-item");
            if (!items.length) return;

            if (e.key === "ArrowDown") {
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                highlightItem(selectedIndex);
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                selectedIndex = Math.max(selectedIndex - 1, 0);
                highlightItem(selectedIndex);
                e.preventDefault();
            } else if (e.key === "Enter") {
                if (selectedIndex >= 0) {
                    const selectedName = items[selectedIndex].textContent;
                    input.value = selectedName;
                    suggestBox.style.display = "none";
                    win.renderDiaHistoryContent(win);
                    selectedIndex = -1;
                }
            } else if (e.key === "Escape") {
                suggestBox.style.display = "none";
                selectedIndex = -1;
            }
        });

        function highlightItem(index) {
            const items = suggestBox?.querySelectorAll(".suggest-item") || [];
            items.forEach((el, i) => {
                if (!el) return; // null 요소 방어!
                el.style.background = i === index ? "#ddd" : "";
            });
        }
    }, 300);

    // ✅ 함수들 먼저 주입
    win.renderDiaHistoryContent = renderDiaHistoryContent;
    win.renderTotalTrendChart = renderTotalTrendChart;
    win.renderServerTrendChart = renderServerTrendChart;

    // ✅ 호출 시점은 requestAnimationFrame 안에서!
    requestAnimationFrame(() => {
        win.renderDiaHistoryContent(win);
        win.renderTotalTrendChart(7, win);
        win.renderServerTrendChart(7, win);

        // ✅ 창 크기 1픽셀 줄였다가 즉시 되돌리는 방식
        win.resizeBy(1, 0);
        win.resizeBy(-1, 0);
    });
}

// ──────────────────────────────────────────────────────────
// TOTAL 추세 그래프 렌더링
// ──────────────────────────────────────────────────────────
function renderTotalTrendChart(dayCount, win = window) {
    console.log("▶ [TOTAL] 함수 시작, dayCount =", dayCount);

    if (!win.chartStore) win.chartStore = {};

    // fetch 직전에 URL 확인
    const totalUrl = `/api/dia-history?days=${dayCount}`;
    console.log("▶ [TOTAL] About to fetch URL:", totalUrl);

    fetch(totalUrl)
        .then(res => {
            console.log(
                `▶ [TOTAL] fetch 응답 status=${res.status}, url=${res.url}`
            );
            return res.json();
        })
        .then(dataMap => {
            console.log(
                "▶ [TOTAL] 받은 데이터 날짜 키:",
                Object.keys(dataMap).sort()
            );

            // 1) 전체 날짜 정렬(과거→최신)
            const allDates = Object.keys(dataMap).sort();
            // 2) 요청된 기간만큼 자르기 (999 또는 0은 전체)
            const dates =
                dayCount > 0 && dayCount < allDates.length
                    ? allDates.slice(-dayCount)
                    : allDates;

            console.log("▶ [TOTAL] 차트에 사용할 labels:", dates);

            // 3) values 준비
            const values = dates.map(date => {
                const tot = dataMap[date].TOTAL;
                return typeof tot === "number" ? tot : tot?.today || 0;
            });

            console.log("▶ [TOTAL] 차트에 사용할 values:", values);

            // 4) 차트 파괴→생성
            requestAnimationFrame(() => {
                const canvas = win.document.getElementById("totalTrendChart");
                if (!canvas) {
                    console.error("▶ [TOTAL] totalTrendChart canvas를 찾을 수 없음");
                    return;
                }

                win.chartStore.totalChart?.destroy();

                const ctx = canvas.getContext("2d");
                win.chartStore.totalChart = new Chart(ctx, {
                    type: "line",
                    data: {
                        labels: dates,
                        datasets: [
                            {
                                label: `TOTAL (${dayCount === 999 ? "전체" : dayCount + "일"})`,
                                data: values,
                                borderColor: "#007bff",
                                backgroundColor: "rgba(0,123,255,0.1)",
                                tension: 0.3,
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {
                                offset: false,
                                alignToPixels: true,
                                ticks: {
                                    padding: 4,
                                    maxRotation: 0
                                    // align: "end" // ← Chart.js 4 이상 사용 시만 활성화
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 }
                            }
                        }
                    }
                });

                win.chartStore.totalChart.resize?.();
                console.log("▶ [TOTAL] 차트 렌더링 완료");
            });
        })
        .catch(err =>
            console.error("▶ [TOTAL] renderTotalTrendChart error:", err)
        );


    // 랜덤 컬러 헬퍼
    function randomColor() {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 180);
        const b = Math.floor(Math.random() * 220);
        return `rgb(${r},${g},${b})`;
    }
}

// ──────────────────────────────────────────────────────────
// 서버별 추세 그래프 렌더링
// ──────────────────────────────────────────────────────────
function renderServerTrendChart(dayCount, win = window) {
    console.log("▶ [SERVER] 함수 시작, dayCount =", dayCount);

    if (!win.chartStore) win.chartStore = {};

    // fetch 직전에 URL 확인
    const serverUrl = `/api/dia-history?days=${dayCount}`;
    console.log("▶ [SERVER] About to fetch URL:", serverUrl);

    fetch(serverUrl)
        .then(res => {
            console.log(
                `▶ [SERVER] fetch 응답 status=${res.status}, url=${res.url}`
            );
            return res.json();
        })
        .then(dataMap => {
            console.log(
                "▶ [SERVER] 받은 데이터 날짜 키:",
                Object.keys(dataMap).sort()
            );

            // 1) 날짜 정렬
            const dates = Object.keys(dataMap).sort();
            console.log("▶ [SERVER] 차트에 사용할 labels:", dates);

            // 2) 서버 이름 추출
            const serverSet = new Set();
            dates.forEach(date => {
                Object.values(dataMap[date]).forEach(v => {
                    if (v && v.server) serverSet.add(v.server);
                });
            });
            const serverList = Array.from(serverSet).sort();
            console.log("▶ [SERVER] 서버 목록:", serverList);

            // 3) 서버별 데이터셋 생성
            const datasets = serverList.map((srv, i) => {
                const dataArr = dates.map(date =>
                    Object.values(dataMap[date])
                        .filter(x => x.server === srv)
                        .reduce((sum, x) => sum + (x.today || 0), 0)
                );
                console.log(`▶ [SERVER] '${srv}' 데이터:`, dataArr);
                return {
                    label: srv,
                    data: dataArr,
                    borderColor: randomColor(),
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2
                };
            });

            // 4) 차트 파괴→생성
            requestAnimationFrame(() => {
                const canvas = win.document.getElementById("serverTrendChart");
                if (!canvas) {
                    console.error("▶ [SERVER] serverTrendChart canvas를 찾을 수 없음");
                    return;
                }

                win.chartStore.serverChart?.destroy();

                const ctx = canvas.getContext("2d");
                win.chartStore.serverChart = new Chart(ctx, {
                    type: "line",
                    data: {labels: dates, datasets},
                    options: {
                        responsive: false,
                        plugins: {
                            legend: {position: "bottom"},
                            tooltip: {mode: "index", intersect: false}
                        },
                        scales: {
                            x: {ticks: {maxRotation: 45, minRotation: 0}},
                            y: {beginAtZero: true}
                        }
                    }
                });

                win.chartStore.serverChart.resize?.();
                console.log("▶ [SERVER] 차트 렌더링 완료");
            });
        })
        .catch(err =>
            console.error("▶ [SERVER] renderServerTrendChart error:", err)
        );


    // 랜덤 컬러 헬퍼
    function randomColor() {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 180);
        const b = Math.floor(Math.random() * 220);
        return `rgb(${r},${g},${b})`;
    }
}


//검색 도우미
function filterClientName(win = window) {
    const inputEl = win.document.getElementById("searchClient");
    if (!inputEl) return;
    const suggestDiv = win.document.getElementById("suggestList");
    if (!suggestDiv) return;

    const input = inputEl.value.trim().toLowerCase();

    const raw = localStorage.getItem("dailyDiaStats");
    if (!raw) return;

    const dataMap = JSON.parse(raw);

    const allNames = new Set();

    Object.values(dataMap).forEach(day => {
        Object.keys(day).forEach(name => {
            if (!["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(name)) {
                allNames.add(name);
            }
        });
    });

    const matched = Array.from(allNames).filter(name =>
        name.toLowerCase().includes(input)
    ).slice(0, 10); // 최대 10개 제한

    suggestDiv.innerHTML = "";
    let selectedIndex = -1;

    matched.forEach((name, index) => {
        const div = win.document.createElement("div");
        div.textContent = name;
        div.className = "suggest-item";
        div.style.padding = "4px 6px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";

        div.onmouseover = () => {
            updateHighlight(index);
        };
        div.onmouseout = () => {
            updateHighlight(-1);
        };
        div.onclick = () => {
            inputEl.value = name;
            suggestDiv.style.display = "none";
            win.renderDiaHistoryContent(win, null, name); // 👈 검색어 전달!
        };
        suggestDiv.appendChild(div);
    });

    suggestDiv.style.display = matched.length ? "block" : "none";

    // 🔼🔽↩️ + ESC 키 이벤트는 여기에서 최초 한 번만 등록
    if (!inputEl._keyboardAttached) {
        inputEl.addEventListener("keydown", (e) => {
            const items = suggestDiv?.querySelectorAll(".suggest-item") || [];
            if (!items.length) return;

            if (e.key === "ArrowDown") {
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateHighlight(selectedIndex);
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateHighlight(selectedIndex);
                e.preventDefault();
            } else if (e.key === "Enter") {
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    const item = items[selectedIndex];
                    if (item?.textContent) {
                        inputEl.value = item.textContent;
                        suggestDiv.style.display = "none";
                        win.renderDiaHistoryContent?.(win, null, inputEl.value);
                        selectedIndex = -1;
                    }
                }
            } else if (e.key === "Escape") {
                suggestDiv.style.display = "none";
                selectedIndex = -1;
            }
        });

        inputEl._keyboardAttached = true; // 중복 등록 방지
    }

    // 🔁 하이라이트 함수
    function updateHighlight(index) {
        const items = suggestDiv.querySelectorAll(".suggest-item");
        items.forEach((el, i) => {
            if (!el) return; // ❗ null 방어 추가
            el.style.background = i === index ? "#ddd" : "";
        });
    }
}

// ========================================
// INI 명령 전송 시스템
// ========================================

// 초기화 함수
function initializeCommandSystem() {
    initializeCommandModal();
    updateTargetCounts();
    updateTemplateButtons(); // 저장된 템플릿 버튼들 로드
}

// 카드 선택 토글
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

// 모든 보이는 카드 선택
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

// 모든 선택 해제
function clearAllSelections() {
    selectedClients.clear();
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    updateSelectedClientsDisplay();
    updateTargetCounts();
}

// 모달 관리 초기화
function initializeCommandModal() {
    const modal = document.getElementById('commandModal');
    const openBtn = document.getElementById('openCommandModal');
    const closeBtn = document.querySelector('#commandModal .close');
    const cancelBtn = document.getElementById('cancelCommand');
    const sendBtn = document.getElementById('sendCommand');

    if (!modal || !openBtn) return;

    // 모달 열기
    openBtn.onclick = () => {
        modal.style.display = 'block';
        isCommandModalOpen = true;
        updateTargetCounts();

        // 모달 열 때 초기화
        initializeModalContent();
    };

    // 모달 닫기
    const closeModal = () => {
        modal.style.display = 'none';
        isCommandModalOpen = false;
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // 배경 클릭으로 닫기
    window.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // 전송 버튼
    if (sendBtn) sendBtn.onclick = sendIniCommand;

    // 대상 선택 변경 시 카운트 업데이트
    document.querySelectorAll('input[name="target"]').forEach(radio => {
        radio.onchange = updateTargetCounts;
    });
}

// 모달 콘텐츠 초기화
function initializeModalContent() {
    // textarea 기본값 설정
    const textarea = document.getElementById('iniContent');
    if (textarea) {
        textarea.value = `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`;
    }

    // 템플릿 선택 상태 초기화
    currentEditingTemplate = null;
    updateTemplateButtonSelection();

    // 대상 미리보기 업데이트
    updateTargetPreview('all');
    updateTargetPreview('filtered');

    // 전체보기 버튼 표시 및 초기화
    const allClients = getTargetClientsByType('all');
    const filteredClients = getTargetClientsByType('filtered');

    const allBtn = document.getElementById('allShowAllBtn');
    const filteredBtn = document.getElementById('filteredShowAllBtn');
    const allList = document.getElementById('allTargetList');
    const filteredList = document.getElementById('filteredTargetList');

    if (allBtn) {
        allBtn.style.display = allClients.length > 3 ? 'inline-block' : 'none';
        // 버튼 상태 초기화
        allBtn.textContent = '전체보기';
        allBtn.style.background = '#f0f0f0';
        allBtn.style.color = '#666';
    }

    if (filteredBtn) {
        filteredBtn.style.display = filteredClients.length > 3 ? 'inline-block' : 'none';
        // 버튼 상태 초기화
        filteredBtn.textContent = '전체보기';
        filteredBtn.style.background = '#f0f0f0';
        filteredBtn.style.color = '#666';
    }

    // 리스트 상태 초기화
    if (allList) {
        allList.style.display = 'none';
    }

    if (filteredList) {
        filteredList.style.display = 'none';
    }

    // 로그 초기화
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '전송을 시작하면 로그가 여기에 표시됩니다.';
    }
}

// 전송 대상 리스트 토글 (더 이상 사용하지 않음)
function toggleTargetList(targetType) {
    // 이 함수는 더 이상 사용하지 않음
}

// 한 줄 미리보기 업데이트
function updateTargetPreview(targetType) {
    const previewElement = document.getElementById(`${targetType}Preview`);
    const clients = getTargetClientsByType(targetType);

    if (clients.length === 0) {
        previewElement.textContent = '';
        return;
    }

    const showLimit = 5;
    const names = clients.slice(0, showLimit).map(client => client.name);

    if (clients.length > showLimit) {
        const remaining = clients.length - showLimit;
        previewElement.textContent = `${names.join(', ')}... 외 ${remaining}개`;
    } else {
        previewElement.textContent = names.join(', ');
    }
}

// 전송 대상 리스트 내용 업데이트 (격자형) - 더 이상 사용하지 않음
function updateTargetListContent(targetType) {
    // 이 함수는 더 이상 사용하지 않음
}

// 타입별 클라이언트 목록 가져오기
function getTargetClientsByType(targetType) {
    const allCards = document.querySelectorAll('.card[data-name]:not(.empty)');

    switch (targetType) {
        case 'all':
            return Array.from(allCards).map(card => ({
                name: card.dataset.name,
                ip: getClientIP(card.dataset.name)
            }));
        case 'filtered':
            const visibleCards = Array.from(allCards).filter(card =>
                card.style.display !== 'none'
            );
            return visibleCards.map(card => ({
                name: card.dataset.name,
                ip: getClientIP(card.dataset.name)
            }));
        case 'selected':
            return Array.from(selectedClients).map(name => {
                return {
                    name: name,
                    ip: getClientIP(name)
                };
            });
        default:
            return [];
    }
}

// 전체 목록 보기 (토글)
function showAllTargets(targetType) {
    const listElement = document.getElementById(`${targetType}TargetList`);
    const btn = document.getElementById(`${targetType}ShowAllBtn`);
    const clients = getTargetClientsByType(targetType);

    // 현재 상태 확인 (표시 상태인지 체크)
    const isVisible = listElement.style.display === 'grid' ||
                     (listElement.style.display !== 'none' && listElement.innerHTML.trim() !== '');

    // 다른 모든 목록 닫기
    ['all', 'filtered', 'selected'].forEach(type => {
        if (type !== targetType) {
            const otherList = document.getElementById(`${type}TargetList`);
            const otherBtn = document.getElementById(`${type}ShowAllBtn`);
            if (otherList) {
                otherList.style.display = 'none';
                otherList.innerHTML = '';
                otherList.style.height = '0';
                otherList.style.padding = '0';
                otherList.style.marginLeft = '0';
                otherList.style.marginTop = '0';
                otherList.style.marginBottom = '0';
                otherList.classList.remove('grid-view');
            }
            if (otherBtn) {
                otherBtn.textContent = '전체보기';
                otherBtn.style.background = '#f0f0f0';
                otherBtn.style.color = '#666';
                otherBtn.style.border = '1px solid #ccc';
            }
        }
    });

    if (isVisible) {
        // 닫기 - 완전히 제거
        listElement.style.display = 'none';
        listElement.innerHTML = '';
        listElement.style.height = '0';
        listElement.style.padding = '0';
        listElement.style.marginLeft = '0';
        listElement.style.marginTop = '0';
        listElement.style.marginBottom = '0';
        listElement.classList.remove('grid-view');
        btn.textContent = '전체보기';
        btn.style.background = '#f0f0f0';
        btn.style.color = '#666';
        btn.style.border = '1px solid #ccc';
    } else {
        // 열기 - 원래 스타일 복원
        listElement.style.display = 'grid';
        listElement.style.gridTemplateColumns = 'repeat(5, 1fr)';
        listElement.style.gap = '6px';
        listElement.style.height = 'auto';
        listElement.style.padding = '12px';

        // 해당 필터의 라디오 버튼 체크
        const targetRadio = document.querySelector(`input[name="target"][value="${targetType}"]`);
        if (targetRadio) {
            targetRadio.checked = true;
        }
        listElement.style.marginLeft = '20px';
        listElement.style.marginTop = '8px';
        listElement.classList.add('grid-view');

        let html = '';
        clients.forEach(client => {
            // 선택 상태 확인
            const isSelected = selectedClients.has(client.name);
            const selectedClass = isSelected ? 'selected' : '';

            html += `<div class="client-item ${selectedClass}"
                          data-name="${client.name}"
                          onclick="toggleClientInTargetList('${client.name}', this)">
                        ${client.name}
                     </div>`;
        });

        listElement.innerHTML = html;

        // 버튼 스타일 변경 (눌린 상태)
        btn.textContent = '닫기';
        btn.style.background = '#2196f3';
        btn.style.color = 'white';
        btn.style.border = '1px solid #1976d2';
    }

    // 클릭 피드백 애니메이션
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = 'scale(1)';
    }, 100);
}

// 현재 활성화된 타겟 타입 확인
function getCurrentActiveTarget() {
    const allList = document.getElementById('allTargetList');
    const filteredList = document.getElementById('filteredTargetList');

    if (allList && allList.style.display === 'grid') {
        return 'all';
    }
    if (filteredList && filteredList.style.display === 'grid') {
        return 'filtered';
    }

    return 'all'; // 기본값
}

// 전체보기 리스트에서 클라이언트 선택/해제
function toggleClientInTargetList(clientName, element) {
    if (selectedClients.has(clientName)) {
        selectedClients.delete(clientName);
        element.classList.remove('selected');
    } else {
        selectedClients.add(clientName);
        element.classList.add('selected');
    }

    // 메인 대시보드의 카드 선택 상태도 동기화
    const mainCard = document.querySelector(`.card[data-name="${clientName}"]`);
    if (mainCard) {
        if (selectedClients.has(clientName)) {
            mainCard.classList.add('selected');
        } else {
            mainCard.classList.remove('selected');
        }
    }

    // 선택박스 상태도 동기화
    const checkbox = mainCard?.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = selectedClients.has(clientName);
    }

    // 현재 활성화된 필터에 맞는 라디오 버튼 체크
    const currentTarget = getCurrentActiveTarget();
    const targetRadio = document.querySelector(`input[name="target"][value="${currentTarget}"]`);
    if (targetRadio) {
        targetRadio.checked = true;
    }

    // 선택 개수 업데이트
    updateTargetCounts();
}

// 대상 클라이언트 수집
function getTargetClients() {
    const targetType = document.querySelector('input[name="target"]:checked')?.value || 'all';
    return getTargetClientsByType(targetType);
}

// 클라이언트 IP 조회
function getClientIP(clientName) {
    const card = document.querySelector(`.card[data-name="${clientName}"]`);
    if (card && card.querySelector('.info')) {
        const infoText = card.querySelector('.info').textContent;
        const lines = infoText.split('\n').map(line => line.trim()).filter(Boolean);
        // 첫 번째 줄이 IP 주소
        return lines[0] || 'unknown';
    }
    return 'unknown';
}

// 대상 수 업데이트
function updateTargetCounts() {
    const allCount = document.querySelectorAll('.card[data-name]:not(.empty)').length;
    const filteredCount = document.querySelectorAll('.card[data-name]:not(.empty):not([style*="display: none"]):not(.ghost-card)').length;
    const selectedCount = selectedClients.size;

    const allCountEl = document.getElementById('allCount');
    const filteredCountEl = document.getElementById('filteredCount');
    const selectedCountEl = document.getElementById('selectedCount');

    if (allCountEl) allCountEl.textContent = allCount;
    if (filteredCountEl) filteredCountEl.textContent = filteredCount;
    if (selectedCountEl) selectedCountEl.textContent = selectedCount;

    // 미리보기 텍스트 업데이트
    updateTargetPreviews();
}

// 대상 미리보기 텍스트 업데이트
function updateTargetPreviews() {
    // 전체 미리보기 (5개 표시)
    const allClients = getTargetClientsByType('all');
    const allPreview = document.getElementById('allPreview');
    if (allPreview) {
        const preview = allClients.slice(0, 5).map(c => c.name).join(', ');
        allPreview.textContent = allClients.length > 5 ? `${preview} 외 ${allClients.length - 5}개` : preview;
    }

    // 필터 미리보기 (5개 표시)
    const filteredClients = getTargetClientsByType('filtered');
    const filteredPreview = document.getElementById('filteredPreview');
    if (filteredPreview) {
        const preview = filteredClients.slice(0, 5).map(c => c.name).join(', ');
        filteredPreview.textContent = filteredClients.length > 5 ? `${preview} 외 ${filteredClients.length - 5}개` : preview;
    }

    // 선택 미리보기
    const selectedClientsList = getTargetClientsByType('selected');
    const selectedPreview = document.getElementById('selectedPreview');
    if (selectedPreview) {
        const preview = selectedClientsList.slice(0, 5).map(c => c.name).join(', ');
        selectedPreview.textContent = selectedClientsList.length > 5 ? `${preview} 외 ${selectedClientsList.length - 5}개` : preview;
    }
}

// 선택된 클라이언트 표시 업데이트
function updateSelectedClientsDisplay() {
    const display = document.getElementById('selectedClients');
    if (!display) return;

    if (selectedClients.size > 0) {
        const clientList = Array.from(selectedClients).join(', ');
        display.innerHTML = `<strong>선택됨:</strong> ${clientList}`;
        display.style.display = 'block';
    } else {
        display.style.display = 'none';
    }
}

// INI 템플릿 시스템
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

// 템플릿 로드 (토글 방식)
function loadTemplate(templateName) {
    const textarea = document.getElementById('iniContent');

    // 이미 선택된 템플릿을 다시 클릭하면 선택 해제
    if (currentEditingTemplate === templateName) {
        // 선택 해제 - 기본값으로 초기화
        if (textarea) {
            textarea.value = `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`;
        }
        currentEditingTemplate = null;
    } else {
        // 새 템플릿 선택
        currentEditingTemplate = templateName;

        if (textarea) {
            if (iniTemplates[templateName]) {
                textarea.value = iniTemplates[templateName];
            } else if (customTemplates[templateName]) {
                textarea.value = customTemplates[templateName];
            }
        }
    }

    // 템플릿 버튼 선택 상태 업데이트
    updateTemplateButtonSelection();
}

// 템플릿 저장
function saveTemplate() {
    const textarea = document.getElementById('iniContent');
    const content = textarea?.value.trim();

    if (!content) {
        alert('저장할 내용이 없습니다.');
        return;
    }

    let templateName;

    if (currentEditingTemplate && customTemplates[currentEditingTemplate]) {
        // 기존 템플릿 수정
        templateName = currentEditingTemplate;
    } else {
        // 새 템플릿 생성
        while (true) {
            templateName = prompt('템플릿 이름을 입력하세요:');
            if (!templateName) return;

            // 중복 이름 체크
            if (iniTemplates[templateName] || customTemplates[templateName]) {
                const overwrite = confirm(`"${templateName}" 템플릿이 이미 존재합니다. 덮어쓰시겠습니까?\n\n취소하면 다른 이름을 입력할 수 있습니다.`);
                if (overwrite) {
                    break; // 덮어쓰기 선택시 반복문 종료
                }
                // 덮어쓰기 거부시 다시 이름 입력받기
            } else {
                break; // 중복이 아니면 반복문 종료
            }
        }
    }

    // 템플릿 저장
    customTemplates[templateName] = content;
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates));
    currentEditingTemplate = templateName;

    // 템플릿 버튼 다시 생성
    updateTemplateButtons();
}

// 템플릿 삭제
function deleteTemplate() {
    if (!currentEditingTemplate) {
        alert('삭제할 템플릿이 선택되지 않았습니다.');
        return;
    }

    if (!customTemplates[currentEditingTemplate]) {
        alert('선택된 템플릿을 찾을 수 없습니다.');
        return;
    }

    if (confirm(`"${currentEditingTemplate}" 템플릿을 삭제하시겠습니까?`)) {
        const deletedName = currentEditingTemplate;
        delete customTemplates[currentEditingTemplate];
        localStorage.setItem('customTemplates', JSON.stringify(customTemplates));

        // UI 업데이트
        currentEditingTemplate = null;
        updateTemplateButtons();

        // textarea를 기본값으로 초기화
        const textarea = document.getElementById('iniContent');
        if (textarea) {
            textarea.value = `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`;
        }
    }
}

// 새 템플릿 추가
function addNewTemplate() {
    try {
        // textarea 내용 초기화
        const textarea = document.getElementById('iniContent');
        if (textarea) {
            textarea.value = `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`;
        }

        // 선택 상태 초기화
        currentEditingTemplate = null;
        updateTemplateButtonSelection();
    } catch (error) {
        console.error('addNewTemplate 오류:', error);
    }
}

// 템플릿 지우기 (기본값으로 초기화)
function clearTemplate() {
    const textarea = document.getElementById('iniContent');
    if (textarea) {
        textarea.value = `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`;
    }
    currentEditingTemplate = null;
    updateTemplateButtonSelection();
}

// 템플릿 버튼 업데이트
function updateTemplateButtons() {
    const templateButtonsContainer = document.querySelector('.template-buttons');
    if (!templateButtonsContainer) return;

    // 기본 버튼들 제거하고 커스텀 템플릿 버튼들만 표시
    templateButtonsContainer.innerHTML = '';

    // 저장된 커스텀 템플릿들 버튼 추가
    Object.keys(customTemplates).forEach(templateName => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = templateName;
        button.dataset.templateName = templateName;
        button.onclick = () => loadTemplate(templateName);

        // 기본 스타일 (선택되지 않은 상태)
        button.style.cssText = 'background-color: white; border: 1px solid #ccc; color: #333;';

        // 우클릭으로 삭제 기능
        button.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
                delete customTemplates[templateName];
                localStorage.setItem('customTemplates', JSON.stringify(customTemplates));
                currentEditingTemplate = null; // 선택 상태 초기화
                updateTemplateButtons();
            }
        };

        templateButtonsContainer.appendChild(button);
    });

    // 선택 상태 업데이트
    updateTemplateButtonSelection();
}

// 템플릿 버튼 선택 상태 업데이트
function updateTemplateButtonSelection() {
    const templateButtons = document.querySelectorAll('.template-buttons button');

    templateButtons.forEach(button => {
        const templateName = button.dataset.templateName;

        if (templateName === currentEditingTemplate) {
            // 선택된 상태 - 파란색 배경
            button.style.cssText = 'background-color: #e3f2fd; border-color: #2196f3; color: #1976d2;';
        } else {
            // 선택되지 않은 상태 - 흰색 배경
            button.style.cssText = 'background-color: white; border: 1px solid #ccc; color: #333;';
        }
    });
}

// 로그창 관리 함수들
function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const colorClass = type === 'success' ? 'color: green' : type === 'error' ? 'color: red' : '';

    const logEntry = `<div style="${colorClass}">[${timeStr}] ${icon} ${message}</div>`;
    logContent.innerHTML += logEntry;

    // 자동 스크롤
    logContent.scrollTop = logContent.scrollHeight;
}

function clearLog() {
    document.getElementById('logContent').innerHTML = '';
}

// INI 전송 함수
async function sendIniCommand() {
    const iniContent = document.getElementById('iniContent')?.value.trim();
    const targets = getTargetClients();

    // 유효성 검사
    if (!iniContent) {
        addLog('INI 내용을 입력해주세요', 'error');
        return;
    }

    if (targets.length === 0) {
        addLog('전송할 대상이 없습니다', 'error');
        return;
    }

    // 확인 대화상자
    const targetType = document.querySelector('input[name="target"]:checked')?.value;
    const typeNames = { all: '전체', filtered: '필터링된', selected: '선택된' };
    const confirmMessage = `${typeNames[targetType]} ${targets.length}개 클라이언트에게 INI 명령을 전송하시겠습니까?`;

    if (!confirm(confirmMessage)) return;

    // 로그 초기화 및 시작 메시지
    clearLog();
    addLog(`전송 시작: ${targets.length}개 클라이언트`);

    try {
        // Flask API로 전송
        const response = await fetch('/api/send-ini', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                clients: targets,
                ini_content: iniContent
            })
        });

        const result = await response.json();

        if (result.success) {
            addLog(`전송 완료: ${result.message}`, 'success');

            // 성공한 클라이언트 목록 표시
            if (result.success_clients && result.success_clients.length > 0) {
                result.success_clients.forEach(client => {
                    addLog(`성공: ${client}`, 'success');
                });
            }

            // 실패한 클라이언트 목록 표시
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    addLog(error, 'error');
                });
            }
        } else {
            addLog(`전송 실패: ${result.message}`, 'error');
        }
    } catch (error) {
        addLog(`통신 오류: ${error.message}`, 'error');
    }

    // 모달 닫기는 하지 않음 (로그 확인을 위해)
}

function toggleCardByCheckbox(checkbox, clientName) {
    if (checkbox.checked) {
        selectedClients.add(clientName);
    } else {
        selectedClients.delete(clientName);
    }
    updateSelectedClientsDisplay();
    updateTargetCounts();
}

//카드영역 전체 클릭시 첵크
document.addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-name]');
    if (card && !card.classList.contains('empty')) {
        const checkbox = card.querySelector('.card-checkbox');
        if (checkbox) {
            // 체크박스 자체를 클릭한 경우가 아니면
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                toggleCardByCheckbox(checkbox, card.dataset.name);
            }
        }
    }
});

//첵크박스 전체해제
function clearAllSelections() {
    selectedClients.clear();
    document.querySelectorAll('.card-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedClientsDisplay();
    updateTargetCounts();
}

// 줄 체크박스 기능 함수들
function toggleRowSelection(rowIndex) {
    const rowCheckbox = document.getElementById(`row-checkbox-${rowIndex}`);

    if (rowCheckbox && rowCheckbox.checked) {
        // 줄 체크박스가 체크되면 모든 개별 카드 체크박스 해제
        clearAllSelections();

        // 다른 줄 체크박스들도 모두 해제
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            if (cb.id !== `row-checkbox-${rowIndex}`) {
                cb.checked = false;
            }
        });
    } else {
        // 줄 체크박스가 해제되면 해당 줄의 카드들만 토글
        const startIndex = rowIndex * 20;
        const endIndex = Math.min(startIndex + 20, document.querySelectorAll('.card').length);

        // 해당 줄의 모든 카드 체크박스 찾기
        const cards = document.querySelectorAll('.card');
        const rowCards = Array.from(cards).slice(startIndex, endIndex);

        // 현재 줄의 체크박스 상태 확인
        const checkboxes = rowCards.map(card => card.querySelector('.card-checkbox')).filter(cb => cb);
        const allChecked = checkboxes.every(cb => cb.checked);

        // 모든 체크박스 토글
        checkboxes.forEach(checkbox => {
            if (checkbox.checked !== !allChecked) {
                checkbox.checked = !allChecked;
                // 기존 개별 선택 함수 호출
                const cardName = checkbox.closest('.card').dataset.name;
                toggleCardByCheckbox(checkbox, cardName);
            }
        });
    }
}

function updateRowCheckboxes() {
    const totalRows = Math.ceil(selectedCards.length / 20);
    for (let row = 0; row < totalRows; row++) {
        const checkbox = document.getElementById(`row-checkbox-${row}`);
        if (checkbox) {
            const startIndex = row * 20;
            const endIndex = Math.min(startIndex + 20, selectedCards.length);
            const rowCards = selectedCards.slice(startIndex, endIndex);
            const allSelected = rowCards.every(card => card && card.selected);
            checkbox.checked = allSelected;
        }
    }
}