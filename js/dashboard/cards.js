// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🎴 Dashboard Cards Module - 클라이언트 카드 렌더링
// ═══════════════════════════════════════════════════════════════════════════════════════════

// UI 이벤트 핸들러
function toggleCondensed() {
    const currentCondensed = getCondensed();
    setCondensed(!currentCondensed);
    document.getElementById("toggle-btn").textContent = getCondensed() ? "전체 모드" : "간결 모드";
    fetchClients();
}

// 서버 요약 정보 출력 (카드보드 & 다이아보드 공용)
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
            const active = server === getServerFilter() ? 'active' : '';
            return `<span class="${active}"
                    onclick="setServerFilter('${server}')">
                ${server}: ${total.toLocaleString()}
              </span>`;
        })
        .join(' | ');

    // 3) 페이지 구분: 다이아보드인지 여부 판단
    const isDiaBoard = location.pathname.includes('dia-history');

    // 4) 카드보드 전용 "전체 보기" 링크
    const allLink = `<span class="${!getServerFilter() ? 'active' : ''}"
                         onclick="setServerFilter('__ALL__')">
                     전체 보기
                   </span>`;

    // 5) 버튼 라벨·이동경로 설정
    const btnLabel = isDiaBoard ? '모니터' : '추적';
    const btnIcon = isDiaBoard ? '📺' : '📅';
    const btnHref = isDiaBoard ? '/' : '/dia-history';
    const historyBtn = `<button onclick="location.href='${btnHref}'" class="gray-btn" style="margin-left:6px;">
                            ${btnLabel}
                          </button>`;

    // 6) HTML 조합 및 출력
    const html = isDiaBoard
        ? `다이아 합산 → ${serverLinks} ${historyBtn}`
        : `다이아 합산 → ${serverLinks} | ${allLink} ${historyBtn}`;

    document.getElementById("serverSummary").innerHTML = html;
}

// 빈 카드 추가
function addEmptyCard() {
    const grid = document.getElementById("dashboard");
    if (!grid) return;

    const now = new Date().toISOString();
    const emptyCard = document.createElement('div');
    emptyCard.className = 'card offline';
    emptyCard.innerHTML = `
        <div class="delete-btn" onclick="deleteCard('새 클라이언트')">삭제</div>
        <div class="name">새 클라이언트</div>
        <div class="info">[미동작 자리]</div>
    `;

    grid.appendChild(emptyCard);
}

// 테스트용 빈 카드 50개 추가
function addTestEmptyCards() {
    const currentOrder = getClientOrder();
    const timestamp = Date.now();

    // 50개의 빈 카드 이름 생성
    for (let i = 1; i <= 50; i++) {
        const cardName = `empty-test-${timestamp}-${i.toString().padStart(2, '0')}`;
        currentOrder.push(cardName);
    }

    // 순서 저장하고 새로고침
    setClientOrder(currentOrder);
    fetchClients();

    console.log('✅ 테스트용 빈 카드 50개가 추가되었습니다.');
}

// 디버깅용 함수
function debugRowCheckboxes() {
    console.log("=== 줄 체크박스 디버깅 ===");

    const allCheckboxes = document.querySelectorAll('.row-checkbox');
    console.log("전체 줄 체크박스 개수:", allCheckboxes.length);

    allCheckboxes.forEach((cb, index) => {
        console.log(`체크박스 ${index}: ID=${cb.id}, checked=${cb.checked}, 위치=${cb.style.left}, ${cb.style.top}`);
    });

    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    console.log("체크된 체크박스 개수:", checkedBoxes.length);

    const order = getClientOrder();
    console.log("카드 순서 총 개수:", order.length);
    console.log("마지막 10개 카드:", order.slice(-10));
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

    // 1~320까지 정확한 위치에 배치 (세로 배치: 컬럼별로 1-20 순서)
    const sortedOrder = [];
    const totalSlots = 320; // 고정 320개
    const columnsPerRow = 20;

    for (let col = 0; col < 16; col++) { // 16컬럼 (320/20)
        for (let row = 1; row <= 20; row++) {
            const number = row + (col * 20);

            if (realCardInfo[number]) {
                // 진짜 카드가 있으면 사용
                sortedOrder.push(realCardInfo[number]);
            } else {
                // 없으면 숫자가 포함된 빈 카드
                sortedOrder.push(`empty-${number}`);
            }
        }
    }

    console.log(`생성된 기본 카드 수: ${sortedOrder.length} (기대값: 320)`);
    console.log(`마지막 10개 카드 번호:`, sortedOrder.slice(-10));

    // 80번째마다 구분 클래스 추가 (4줄 세트 구분)
    setTimeout(() => {
        const cards = document.querySelectorAll('#dashboard .card');
        cards.forEach((card, index) => {
            // 80번째, 160번째, 240번째 카드에 구분선 클래스 추가
            if ((index + 1) % 80 === 0) {
                card.classList.add('set-separator');
                console.log(`구분선 추가: ${index + 1}번째 카드`);
            }
        });
    }, 500);

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

// 카드 삭제
function deleteCard(name) {
    // 빈 카드만 삭제 가능 (안전 장치)
    if (!name.startsWith('empty-') && !name.includes('빈자리')) {
        alert("진짜 카드는 삭제할 수 없습니다!");
        return;
    }

    // 빈 카드 텍스트 삭제
    deleteEmptyCardText(name);

    // 저장된 순서에서 제거
    const order = getClientOrder();
    const newOrder = order.filter(cardName => cardName !== name);
    setClientOrder(newOrder);

    // 즉시 화면 갱신 (예전 방식)
    fetchClients();

    console.log(`빈 카드 삭제: ${name}`);
}

// 선택된 행 삭제
function deleteSelectedRows() {
    const selected = getSelectedClients();
    if (selected.size === 0) {
        alert('삭제할 클라이언트가 선택되지 않았습니다.');
        return;
    }

    if (!confirm(`선택된 ${selected.size}개 클라이언트를 삭제하시겠습니까?`)) {
        return;
    }

    // 선택된 카드들 삭제
    selected.forEach(clientName => {
        deleteCard(clientName);
    });

    // 선택 상태 초기화
    clearSelectedClients();
    clearAllSelections();
}

// 카드 선택 토글
function toggleCardSelection(card) {
    const clientName = card.querySelector('.name')?.textContent;
    if (!clientName) return;

    const checkbox = card.querySelector('.card-checkbox');

    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        checkbox.checked = false;
        removeSelectedClient(clientName);
    } else {
        card.classList.add('selected');
        checkbox.checked = true;
        addSelectedClient(clientName);
    }

    updateTargetCounts();
}

// 모든 보이는 카드 선택
function selectAllVisibleCards() {
    const visibleCards = document.querySelectorAll('.card:not([style*="display: none"])');

    visibleCards.forEach(card => {
        const clientName = card.querySelector('.name')?.textContent;
        if (clientName) {
            card.classList.add('selected');
            const checkbox = card.querySelector('.card-checkbox');
            if (checkbox) checkbox.checked = true;
            addSelectedClient(clientName);
        }
    });

    updateTargetCounts();
}

// 개별 카드만 선택 해제 (줄 체크박스는 제외)
function clearCardSelections() {
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
        const checkbox = card.querySelector('.card-checkbox');
        if (checkbox) checkbox.checked = false;
    });

    clearSelectedClients();
    updateTargetCounts();
}

// 모든 선택 해제 (개별 카드 + 줄 체크박스)
function clearAllSelections() {
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
        const checkbox = card.querySelector('.card-checkbox');
        if (checkbox) checkbox.checked = false;
    });

    // 줄 체크박스들도 모두 해제 (커스텀 체크박스 처리)
    document.querySelectorAll('.row-checkbox').forEach(rowCheckbox => {
        rowCheckbox.checked = false;
    });

    // 커스텀 체크박스들도 해제
    document.querySelectorAll('.row-checkbox-custom').forEach(customCheckbox => {
        customCheckbox.dataset.checked = 'false';
        customCheckbox.style.backgroundColor = '#fff';
        customCheckbox.style.color = '#007bff';
        customCheckbox.style.transform = 'scale(1)';
    });

    clearSelectedClients();
    updateTargetCounts();
}

// 체크박스로 카드 토글
function toggleCardByCheckbox(checkbox, clientName) {
    const card = checkbox.closest('.card');
    if (!card) return;

    if (checkbox.checked) {
        card.classList.add('selected');
        addSelectedClient(clientName);
    } else {
        card.classList.remove('selected');
        removeSelectedClient(clientName);
    }

    updateTargetCounts();
}

// 행 선택 토글 (레거시 함수)
function toggleRowSelection(rowIndex) {
    const cards = document.querySelectorAll('.card');
    if (rowIndex < cards.length) {
        toggleCardSelection(cards[rowIndex]);
    }
}

// 줄 체크박스 기능 함수들
function toggleRowSelection(rowIndex) {
    // 커스텀 체크박스 찾기 (새로운 방식)
    const rowCheckbox = document.getElementById(`row-checkbox-${rowIndex}`);

    if (!rowCheckbox) {
        console.error('❌ 줄 체크박스를 찾을 수 없음:', `row-checkbox-${rowIndex}`);
        return;
    }

    // 커스텀 체크박스의 data-checked 속성 사용
    const isNowChecked = rowCheckbox.dataset.checked === 'true';

    if (isNowChecked) {
        // 줄 체크박스가 체크된 상태 - 해당 줄의 모든 카드 선택

        // 해당 줄의 모든 카드 체크박스 찾아서 선택
        const startIndex = rowIndex * 20;
        const endIndex = Math.min(startIndex + 20, document.querySelectorAll('.card').length);
        const cards = document.querySelectorAll('.card');
        const rowCards = Array.from(cards).slice(startIndex, endIndex);

        rowCards.forEach(card => {
            const checkbox = card.querySelector('.card-checkbox');
            if (checkbox) {
                checkbox.checked = true;
                const cardName = card.dataset.name;
                if (cardName) {
                    card.classList.add('selected');
                    addSelectedClient(cardName);
                }
            }
        });

        // 타겟 카운트 업데이트
        updateTargetCounts();

    } else {
        // 줄 체크박스 해제 - 해당 줄의 카드들 모두 해제
        const startIndex = rowIndex * 20;
        const endIndex = Math.min(startIndex + 20, document.querySelectorAll('.card').length);
        const cards = document.querySelectorAll('.card');
        const rowCards = Array.from(cards).slice(startIndex, endIndex);

        rowCards.forEach(card => {
            const checkbox = card.querySelector('.card-checkbox');
            if (checkbox) {
                checkbox.checked = false;
                const cardName = card.dataset.name;
                if (cardName) {
                    card.classList.remove('selected');
                    removeSelectedClient(cardName);
                }
            }
        });

        // 타겟 카운트 업데이트
        updateTargetCounts();
    }
}

// 행 체크박스 업데이트 (레거시 함수)
function updateRowCheckboxes() {
    document.querySelectorAll('.card').forEach((card, index) => {
        const checkbox = card.querySelector('.card-checkbox');
        const clientName = card.querySelector('.name')?.textContent;

        if (checkbox && clientName) {
            checkbox.checked = getSelectedClients().has(clientName);
            card.classList.toggle('selected', checkbox.checked);
        }
    });
}

// 선택된 줄 삭제 (빈 카드만)
function deleteSelectedRows() {
    // 체크된 줄 체크박스들 찾기
    const checkedRowCheckboxes = document.querySelectorAll('.row-checkbox:checked');

    if (checkedRowCheckboxes.length === 0) {
        alert('삭제할 줄을 선택해주세요.\\n\\n줄 왼쪽의 체크박스를 선택하세요.');
        return;
    }

    // 현재 카드 순서 가져오기
    const order = getClientOrder();

    // 선택된 줄들 중 진짜 카드가 있는 줄 체크
    const safeRowsToDelete = [];
    const blockedRows = [];

    checkedRowCheckboxes.forEach(checkbox => {
        const rowMatch = checkbox.id.match(/row-checkbox-(\d+)/);

        if (rowMatch) {
            const rowIndex = parseInt(rowMatch[1]); // 0-based 인덱스
            const rowNum = rowIndex + 1; // 표시용 1-based 번호
            const startIndex = rowIndex * 20;
            const endIndex = Math.min(startIndex + 20, order.length);

            // 해당 줄에 진짜 카드가 있는지 확인
            let hasRealCard = false;
            const rowCards = [];

            for (let i = startIndex; i < endIndex; i++) {
                if (order[i]) {
                    rowCards.push(order[i]);
                    const cardName = order[i];
                    const isEmpty = cardName.startsWith('empty-') || cardName === '새 클라이언트';

                    if (!isEmpty) {
                        hasRealCard = true;
                    }
                }
            }

            if (hasRealCard) {
                blockedRows.push(rowNum);
            } else {
                safeRowsToDelete.push({rowNum, cards: rowCards});
            }
        }
    });

    // 진짜 카드가 있는 줄이 있으면 경고
    if (blockedRows.length > 0) {
        alert(`${blockedRows.join(', ')}번째 줄에는 실제 클라이언트가 있어서 삭제할 수 없습니다.\\n빈 카드만 있는 줄만 삭제 가능합니다.`);
        return;
    }

    // 삭제 확인
    if (!confirm(`${safeRowsToDelete.length}개 줄의 빈 카드들을 삭제하시겠습니까?`)) {
        return;
    }

    // 삭제 실행
    let deletedCount = 0;
    safeRowsToDelete.forEach(row => {
        row.cards.forEach(cardName => {
            deleteCard(cardName);
            deletedCount++;
        });
    });

    // 줄 체크박스 해제
    checkedRowCheckboxes.forEach(cb => cb.checked = false);

    alert(`${deletedCount}개의 빈 카드가 삭제되었습니다.`);
}