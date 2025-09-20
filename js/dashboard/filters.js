// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔍 Dashboard Filters Module - 검색 및 필터링 기능
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 다이아 범위 토글
function toggleDiaRange() {
    const currentMode = getIsDiaRangeMode();
    setIsDiaRangeMode(!currentMode);

    const maxInput = document.getElementById('maxDiaInput');
    const rangeIndicator = document.getElementById('rangeIndicator');
    const toggleBtn = document.getElementById('rangeToggle');

    if (getIsDiaRangeMode()) {
        // 범위 모드 활성화
        maxInput.style.display = 'inline-block';
        rangeIndicator.style.display = 'inline';
        toggleBtn.textContent = '단일';
        toggleBtn.style.background = '#007bff';
        toggleBtn.style.color = 'white';
    } else {
        // 단일 값 모드
        maxInput.style.display = 'none';
        rangeIndicator.style.display = 'none';
        toggleBtn.textContent = '범위';
        toggleBtn.style.background = '#f8f9fa';
        toggleBtn.style.color = '#666';
    }

    applyFilters();
}

// 필터 적용
function applyFilters() {
    const searchText = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    const minDia = parseInt(document.getElementById('minDiaInput')?.value || '0');
    const maxDia = getIsDiaRangeMode() ?
        parseInt(document.getElementById('maxDiaInput')?.value || '999999999') : 999999999;
    const server = getServerFilter();

    const cards = document.querySelectorAll('.card');
    let visibleCount = 0;

    cards.forEach(card => {
        const isEmpty = card.classList.contains('empty');
        const cardServer = card.dataset.server || '';
        const fullText = card.textContent.toLowerCase();

        // 1) 텍스트 검색 매칭
        const matchesText = !searchText || fullText.includes(searchText);

        // 2) 서버 필터 매칭
        const matchesServer = !server || isEmpty || cardServer === server;

        // 3) 다이아 수량 매칭
        let matchesDia = true;
        if (!isEmpty && (minDia > 0 || getIsDiaRangeMode())) {
            const diaValue = parseInt(card.dataset.dia || '0');

            if (getIsDiaRangeMode()) {
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

        // 4) ghost 상태 제거 후 재적용
        card.classList.remove('ghost-card');
        card.style.display = '';

        // 모든 조건을 검사해서 하나라도 맞지 않으면 ghost 처리
        const shouldGhost = !matchesText || !matchesServer || !matchesDia;
        if (shouldGhost) {
            card.classList.add('ghost-card');
        } else {
            visibleCount++;
        }
    });

    // 필터 결과 로그
    console.log(`필터 적용: ${visibleCount}/${cards.length} 카드 활성화`);

    // 선택 상태 업데이트
    updateRowCheckboxes();
}

// 검색어 하이라이트 (고급 기능)
function highlightSearchTerms(text, searchText) {
    if (!searchText) return text;

    const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 필터 상태 확인
function getFilterStatus() {
    const searchText = document.getElementById('searchInput')?.value || '';
    const minDia = document.getElementById('minDiaInput')?.value || '';
    const maxDia = getIsDiaRangeMode() ?
        (document.getElementById('maxDiaInput')?.value || '') : '';

    return {
        hasSearch: searchText.length > 0,
        hasMinDia: minDia.length > 0,
        hasMaxDia: maxDia.length > 0,
        hasServerFilter: getServerFilter() !== null,
        searchText,
        minDia,
        maxDia,
        serverFilter: getServerFilter()
    };
}

// 필터 초기화
function resetAllFilters() {
    // 검색 입력 초기화
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    // 다이아 필터 초기화
    const minDiaInput = document.getElementById('minDiaInput');
    if (minDiaInput) minDiaInput.value = '';

    const maxDiaInput = document.getElementById('maxDiaInput');
    if (maxDiaInput) maxDiaInput.value = '';

    // 범위 모드 해제
    if (getIsDiaRangeMode()) {
        toggleDiaRange();
    }

    // 서버 필터 해제
    setServerFilter('__ALL__');

    // 필터 적용
    applyFilters();
}

// 필터 프리셋 저장/로드
function saveFilterPreset(name) {
    const status = getFilterStatus();
    const presets = JSON.parse(localStorage.getItem('filterPresets') || '{}');
    presets[name] = status;
    localStorage.setItem('filterPresets', JSON.stringify(presets));
}

function loadFilterPreset(name) {
    const presets = JSON.parse(localStorage.getItem('filterPresets') || '{}');
    const preset = presets[name];

    if (!preset) return false;

    // 검색어 적용
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = preset.searchText || '';

    // 다이아 필터 적용
    const minDiaInput = document.getElementById('minDiaInput');
    if (minDiaInput) minDiaInput.value = preset.minDia || '';

    const maxDiaInput = document.getElementById('maxDiaInput');
    if (maxDiaInput) maxDiaInput.value = preset.maxDia || '';

    // 범위 모드 설정
    if (preset.hasMaxDia && !getIsDiaRangeMode()) {
        toggleDiaRange();
    } else if (!preset.hasMaxDia && getIsDiaRangeMode()) {
        toggleDiaRange();
    }

    // 서버 필터 적용
    if (preset.serverFilter) {
        setServerFilter(preset.serverFilter);
    } else {
        setServerFilter('__ALL__');
    }

    // 필터 적용
    applyFilters();

    return true;
}

// 빠른 필터 버튼들
function createQuickFilters() {
    const container = document.getElementById('quickFilters');
    if (!container) return;

    const quickFilters = [
        { name: '고다이아', filter: { minDia: 10000 } },
        { name: '중다이아', filter: { minDia: 5000, maxDia: 9999 } },
        { name: '저다이아', filter: { maxDia: 4999 } },
        { name: '최근접속', filter: { recent: true } }
    ];

    container.innerHTML = quickFilters.map(qf =>
        `<button onclick="applyQuickFilter('${qf.name}')" class="quick-filter-btn">
            ${qf.name}
        </button>`
    ).join('');
}

function applyQuickFilter(filterName) {
    const filters = {
        '고다이아': { minDia: '10000' },
        '중다이아': { minDia: '5000', maxDia: '9999' },
        '저다이아': { maxDia: '4999' },
        '최근접속': { recent: true }
    };

    const filter = filters[filterName];
    if (!filter) return;

    // 기존 필터 초기화
    resetAllFilters();

    // 새 필터 적용
    if (filter.minDia) {
        document.getElementById('minDiaInput').value = filter.minDia;
    }
    if (filter.maxDia) {
        if (!getIsDiaRangeMode()) toggleDiaRange();
        document.getElementById('maxDiaInput').value = filter.maxDia;
    }

    applyFilters();
}