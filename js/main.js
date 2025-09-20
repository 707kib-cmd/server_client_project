// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🚀 Main Entry Point - 애플리케이션 초기화 및 이벤트 바인딩
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🌟 모듈화된 대시보드 시스템
 *
 * 구조:
 * - core/: API, 유틸리티, 상태 관리
 * - dashboard/: 카드, 필터링 기능
 * - charts/: 차트 및 히스토리 기능
 * - modals/: 모달 및 템플릿 관리
 * - main.js: 진입점 및 초기화
 */

// 📋 전역 설정
window.dashboardConfig = {
    version: '2.0.0-modular',
    apiTimeout: 10000,
    refreshInterval: 60,
    autoInitialize: true
};

// 🏗️ 애플리케이션 초기화
function initializeApp() {
    console.log(`🚀 Dashboard v${window.dashboardConfig.version} 시작`);

    try {
        // 1) 상태 관리 초기화
        initializeState();
        console.log('✅ 상태 관리 초기화 완료');

        // 2) 갱신 시스템 초기화
        initializeRefreshInterval();
        console.log('✅ 갱신 시스템 초기화 완료');

        // 3) INI 명령 시스템 초기화
        initializeCommandSystem();
        console.log('✅ INI 명령 시스템 초기화 완료');

        // 4) 이벤트 리스너 설정
        setupEventListeners();
        console.log('✅ 이벤트 리스너 설정 완료');

        // 5) 초기 데이터 로드
        loadInitialData();
        console.log('✅ 초기 데이터 로드 시작');

        // 6) 빈 카드 텍스트 복원
        restoreEmptyCardTexts();
        console.log('✅ 빈 카드 텍스트 복원 완료');

    } catch (error) {
        console.error('❌ 애플리케이션 초기화 실패:', error);
        showErrorMessage('애플리케이션 초기화에 실패했습니다: ' + error.message);
    }
}

// 🎯 이벤트 리스너 설정
function setupEventListeners() {
    // 검색 필터 이벤트
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    const minDiaInput = document.getElementById('minDiaInput');
    if (minDiaInput) {
        minDiaInput.addEventListener('input', debounce(applyFilters, 300));
    }

    const maxDiaInput = document.getElementById('maxDiaInput');
    if (maxDiaInput) {
        maxDiaInput.addEventListener('input', debounce(applyFilters, 300));
    }

    // 갱신 버튼 이벤트
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const interval = parseInt(btn.dataset.interval);
            setRefreshInterval(interval);
        });
    });

    // 키보드 단축키
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // 카드 클릭 이벤트 (체크박스 토글만)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.card[data-name]');
        if (card) {
            // 일반 카드 체크박스 토글 (빈 카드는 제외)
            if (!card.classList.contains('empty')) {
                const checkbox = card.querySelector('.card-checkbox');
                if (checkbox) {
                    // 체크박스 자체를 클릭한 경우가 아니면
                    if (e.target !== checkbox && e.target.className !== 'delete-btn') {
                        checkbox.checked = !checkbox.checked;
                        toggleCardByCheckbox(checkbox, card.dataset.name);
                    }
                }
            }
        }
    });

    // 빈 카드 더블클릭 이벤트 (편집)
    document.addEventListener('dblclick', (e) => {
        const card = e.target.closest('.card[data-name]');
        if (card && card.classList.contains('empty')) {
            if (e.target.className !== 'delete-btn' && !e.target.classList.contains('edit-textarea')) {
                startEditEmptyCard(card);
            }
        }
    });

    // 윈도우 이벤트
    window.addEventListener('beforeunload', () => {
        // 설정 저장
        saveCurrentSettings();
    });
}

// ⚡ 초기 데이터 로드
async function loadInitialData() {
    try {
        // 메인 대시보드인 경우
        if (document.getElementById('dashboard')) {
            await fetchClients();
        }

        // 다이아 히스토리 페이지인 경우
        if (document.getElementById('diaHistoryContent')) {
            renderDiaHistoryContent(window);
            renderTotalTrendChart(7, window);
            renderServerTrendChart(7, window);
        }

    } catch (error) {
        console.error('❌ 초기 데이터 로드 실패:', error);
        showErrorMessage('데이터를 불러오는데 실패했습니다: ' + error.message);
    }
}

// ⌨️ 키보드 단축키 처리
function handleKeyboardShortcuts(e) {
    // Ctrl+R: 수동 새로고침
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        fetchClients();
        return;
    }

    // Ctrl+A: 모든 카드 선택
    if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAllVisibleCards();
        return;
    }

    // Escape: 모달 닫기
    if (e.key === 'Escape') {
        const modal = document.getElementById('commandModal');
        if (modal && modal.style.display === 'block') {
            modal.style.display = 'none';
            setIsCommandModalOpen(false);
        }
        return;
    }

    // F5: 강제 새로고침
    if (e.key === 'F5') {
        location.reload();
        return;
    }
}

// 💾 현재 설정 저장
function saveCurrentSettings() {
    try {
        const settings = {
            refreshInterval: getRefreshInterval(),
            condensedMode: getCondensed(),
            serverFilter: getServerFilter(),
            diaRangeMode: getIsDiaRangeMode(),
            timestamp: Date.now()
        };

        localStorage.setItem('dashboardSettings', JSON.stringify(settings));
        console.log('✅ 설정 저장 완료');
    } catch (error) {
        console.warn('⚠️ 설정 저장 실패:', error);
    }
}

// 📖 설정 복원
function loadSavedSettings() {
    try {
        const saved = localStorage.getItem('dashboardSettings');
        if (!saved) return;

        const settings = JSON.parse(saved);

        // 갱신 간격 복원
        if (settings.refreshInterval) {
            setRefreshInterval(settings.refreshInterval);
        }

        // 간결 모드 복원
        if (settings.condensedMode) {
            setCondensed(settings.condensedMode);
            document.getElementById("toggle-btn").textContent =
                getCondensed() ? "전체 모드" : "간결 모드";
        }

        // 다이아 범위 모드 복원
        if (settings.diaRangeMode) {
            setIsDiaRangeMode(settings.diaRangeMode);
            if (getIsDiaRangeMode()) {
                toggleDiaRange();
            }
        }

        console.log('✅ 설정 복원 완료');
    } catch (error) {
        console.warn('⚠️ 설정 복원 실패:', error);
    }
}

// 🚨 에러 메시지 표시
function showErrorMessage(message) {
    // 기존 에러 메시지 제거
    const existingError = document.querySelector('.error-banner');
    if (existingError) {
        existingError.remove();
    }

    // 새 에러 메시지 생성
    const errorBanner = document.createElement('div');
    errorBanner.className = 'error-banner';
    errorBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #dc3545;
        color: white;
        padding: 10px;
        text-align: center;
        z-index: 9999;
        font-weight: bold;
    `;
    errorBanner.innerHTML = `
        ${message}
        <button onclick="this.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            margin-left: 10px;
            cursor: pointer;
            font-size: 16px;
        ">×</button>
    `;

    document.body.insertBefore(errorBanner, document.body.firstChild);

    // 5초 후 자동 제거
    setTimeout(() => {
        if (errorBanner.parentElement) {
            errorBanner.remove();
        }
    }, 5000);
}

// 🎪 성공 메시지 표시
function showSuccessMessage(message) {
    const successBanner = document.createElement('div');
    successBanner.className = 'success-banner';
    successBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #28a745;
        color: white;
        padding: 10px;
        text-align: center;
        z-index: 9999;
        font-weight: bold;
    `;
    successBanner.innerHTML = `
        ${message}
        <button onclick="this.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            margin-left: 10px;
            cursor: pointer;
            font-size: 16px;
        ">×</button>
    `;

    document.body.insertBefore(successBanner, document.body.firstChild);

    setTimeout(() => {
        if (successBanner.parentElement) {
            successBanner.remove();
        }
    }, 3000);
}

// 📝 빈 카드 편집 기능
function startEditEmptyCard(card) {
    const currentText = getEmptyCardText(card.dataset.name);
    const nameDiv = card.querySelector('.name');

    // 이미 편집 중이면 무시
    if (card.querySelector('.edit-textarea')) return;

    // textarea 생성
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = currentText;
    textarea.style.cssText = `
        width: 100%;
        height: 60px;
        border: 2px solid #007bff;
        border-radius: 4px;
        padding: 4px;
        font-size: 11px;
        font-family: inherit;
        resize: none;
        background: #fff;
        color: #333;
        outline: none;
        box-sizing: border-box;
    `;

    // 기존 내용 숨기기
    nameDiv.style.display = 'none';
    card.querySelector('.info').style.display = 'none';

    // textarea 추가
    card.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // 이벤트 리스너
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishEditEmptyCard(card, textarea.value);
        }
        if (e.key === 'Escape') {
            finishEditEmptyCard(card, currentText); // 취소
        }
    });

    textarea.addEventListener('blur', () => {
        finishEditEmptyCard(card, textarea.value);
    });
}

function finishEditEmptyCard(card, newText) {
    const textarea = card.querySelector('.edit-textarea');
    if (!textarea) return;

    // 텍스트 저장
    saveEmptyCardText(card.dataset.name, newText.trim());

    // UI 복원
    const nameDiv = card.querySelector('.name');
    const infoDiv = card.querySelector('.info');

    nameDiv.style.display = 'block';
    infoDiv.style.display = 'block';
    textarea.remove();

    // 카드 내용 업데이트
    updateEmptyCardDisplay(card);
}

function getEmptyCardText(cardName) {
    const saved = localStorage.getItem('emptyCardTexts');
    if (!saved) return '';

    try {
        const texts = JSON.parse(saved);
        return texts[cardName] || '';
    } catch {
        return '';
    }
}

function saveEmptyCardText(cardName, text) {
    let texts = {};
    const saved = localStorage.getItem('emptyCardTexts');

    if (saved) {
        try {
            texts = JSON.parse(saved);
        } catch {}
    }

    if (text.trim()) {
        texts[cardName] = text.trim();
    } else {
        delete texts[cardName];
    }

    localStorage.setItem('emptyCardTexts', JSON.stringify(texts));
}

function deleteEmptyCardText(cardName) {
    const saved = localStorage.getItem('emptyCardTexts');
    if (!saved) return;

    try {
        const texts = JSON.parse(saved);
        delete texts[cardName];
        localStorage.setItem('emptyCardTexts', JSON.stringify(texts));
        console.log(`✅ 빈 카드 텍스트 삭제: ${cardName}`);
    } catch (error) {
        console.warn('⚠️ 빈 카드 텍스트 삭제 실패:', error);
    }
}

function updateEmptyCardDisplay(card) {
    const cardName = card.dataset.name;
    const savedText = getEmptyCardText(cardName);
    const infoDiv = card.querySelector('.info');

    if (savedText) {
        // 강제로 선명하게 만들기
        const displayText = savedText.length > 80 ? savedText.substring(0, 77) + '...' : savedText;
        infoDiv.innerHTML = `<div style="
            font-weight: bold !important;
            color: #000 !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            text-shadow: none !important;
            opacity: 1 !important;
            margin: 0 !important;
            padding: 0 !important;
        ">${displayText}</div>`;
    } else {
        // 텍스트가 없으면 기본 표시
        infoDiv.innerHTML = '[미동작 자리]';
    }
}

// 페이지 로드 시 저장된 텍스트 복원
function restoreEmptyCardTexts() {
    setTimeout(() => {
        document.querySelectorAll('.card.empty').forEach(card => {
            updateEmptyCardDisplay(card);
        });
    }, 500);
}

// 🔧 개발자 도구
window.dashboardDebug = {
    getState: exportState,
    resetSettings: () => {
        localStorage.removeItem('dashboardSettings');
        localStorage.removeItem('customTemplates');
        localStorage.removeItem('clientOrder');
        localStorage.removeItem('refreshInterval');
        location.reload();
    },
    showModuleInfo: () => {
        console.log('📊 로드된 모듈들:');
        console.log('- Core:', typeof getApiUrl !== 'undefined');
        console.log('- Utils:', typeof generateSparkline !== 'undefined');
        console.log('- State:', typeof getCondensed !== 'undefined');
        console.log('- Cards:', typeof toggleCondensed !== 'undefined');
        console.log('- Filters:', typeof applyFilters !== 'undefined');
        console.log('- Charts:', typeof renderTotalTrendChart !== 'undefined');
        console.log('- Modals:', typeof initializeCommandSystem !== 'undefined');
        console.log('- Templates:', typeof loadTemplate !== 'undefined');
    }
};

// 🎬 페이지 로드시 자동 초기화
if (window.dashboardConfig.autoInitialize) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
}

// 전역 함수로 노출 (하위 호환성)
window.fetchClients = fetchClients;
window.applyFilters = applyFilters;
window.toggleCondensed = toggleCondensed;
window.deleteEmptyCardText = deleteEmptyCardText;