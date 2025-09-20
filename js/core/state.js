// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🗃️ State Core Module - 전역 상태 관리
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ✅ 상태값들
let condensed = false;
let serverFilter = null;

// INI 명령 전송 관련 전역 변수
let selectedClients = new Set();
let isCommandModalOpen = false;
let customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '{}');
let currentEditingTemplate = null;

// 갱신 관련 변수
let refreshIntervalId = null;
let progressInterval = null;

// 다이아 범위 필터 모드
let isDiaRangeMode = false;

// 상태 접근자 함수들
function getCondensed() {
    return condensed;
}

function setCondensed(value) {
    condensed = value;
}

function getServerFilter() {
    return serverFilter;
}

function setServerFilter(name) {
    serverFilter = name === '__ALL__' ? null : name;
    if (typeof fetchClients === 'function') {
        fetchClients();
    }
}

function getSelectedClients() {
    return selectedClients;
}

function addSelectedClient(clientName) {
    selectedClients.add(clientName);
}

function removeSelectedClient(clientName) {
    selectedClients.delete(clientName);
}

function clearSelectedClients() {
    selectedClients.clear();
}

function getCustomTemplates() {
    return customTemplates;
}

function setCustomTemplates(templates) {
    customTemplates = templates;
    localStorage.setItem('customTemplates', JSON.stringify(templates));
}

function getCurrentEditingTemplate() {
    return currentEditingTemplate;
}

function setCurrentEditingTemplate(templateName) {
    currentEditingTemplate = templateName;
}

function getIsCommandModalOpen() {
    return isCommandModalOpen;
}

function setIsCommandModalOpen(value) {
    isCommandModalOpen = value;
}

function getIsDiaRangeMode() {
    return isDiaRangeMode;
}

function setIsDiaRangeMode(value) {
    isDiaRangeMode = value;
}

// 갱신 관련 상태
function getRefreshIntervalId() {
    return refreshIntervalId;
}

function setRefreshIntervalId(id) {
    refreshIntervalId = id;
}

function getProgressInterval() {
    return progressInterval;
}

function setProgressInterval(id) {
    progressInterval = id;
}

// 전역 상태 초기화
function initializeState() {
    // 로컬스토리지에서 설정 복원
    const savedTemplates = localStorage.getItem('customTemplates');
    if (savedTemplates) {
        try {
            customTemplates = JSON.parse(savedTemplates);
        } catch (e) {
            console.warn('템플릿 복원 실패:', e);
            customTemplates = {};
        }
    }
}

// 상태 내보내기 (디버깅용)
function exportState() {
    return {
        condensed,
        serverFilter,
        selectedClients: Array.from(selectedClients),
        isCommandModalOpen,
        customTemplates,
        currentEditingTemplate,
        isDiaRangeMode
    };
}