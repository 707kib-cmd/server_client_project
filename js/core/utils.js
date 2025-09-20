// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🛠️ Utils Core Module - 공통 유틸리티 함수들
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 스파크라인 생성
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

// 타임스탬프 정리
function trimTimestamp(ts) {
    return ts.replace(/^20\d\d-/, '');
}

// 갱신 간격 기준 임계값 계산
function getThresholdMs() {
    // 갱신 간격을 상태 체크 기준으로 사용
    const refreshInterval = getRefreshInterval(); // 초 단위
    return refreshInterval * 1000; // 밀리초로 변환
}

// 차이값 포맷팅
function formatDiff(curr, prev) {
    const diff = curr - prev;
    return diff > 0 ? `+${diff}` : `${diff}`;
}

// 키워드 하이라이트
function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 로컬 스토리지 관련
function getClientOrder() {
    return JSON.parse(localStorage.getItem('clientOrder') || '[]');
}

function setClientOrder(order) {
    localStorage.setItem('clientOrder', JSON.stringify(order));
}

// 갱신 간격 관리
function getRefreshInterval() {
    return parseInt(localStorage.getItem('refreshInterval') || '60');
}

function setRefreshInterval(seconds) {
    localStorage.setItem('refreshInterval', seconds.toString());

    // 기존 갱신 중지
    if (window.refreshIntervalId) {
        clearInterval(window.refreshIntervalId);
        window.refreshIntervalId = null;
    }
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }

    // 새로운 갱신 시작
    if (seconds > 0) {
        window.refreshIntervalId = setInterval(() => {
            if (typeof fetchClients === 'function') {
                fetchClients();
            }
        }, seconds * 1000);

        // 진행률 바 시작
        startProgressAnimation(seconds);
    }

    updateRefreshButtons(seconds);
}

// 진행률 바 애니메이션
function startProgressAnimation(totalSeconds) {
    const progressBar = document.getElementById('refreshProgressBar');
    if (!progressBar) return;

    let elapsed = 0;
    const interval = 100; // 100ms 간격

    window.progressInterval = setInterval(() => {
        elapsed += interval;
        const progress = (elapsed / (totalSeconds * 1000)) * 100;

        if (progress >= 100) {
            progressBar.style.width = '0%';
            elapsed = 0;
        } else {
            progressBar.style.width = `${progress}%`;
        }
    }, interval);
}

// 갱신 버튼 상태 업데이트
function updateRefreshButtons(activeInterval) {
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        const interval = parseInt(btn.dataset.interval);
        btn.style.backgroundColor = interval === activeInterval ? '#007bff' : '#6c757d';
        btn.style.color = 'white';
    });
}

// 갱신 시스템 초기화
function initializeRefreshInterval() {
    const savedInterval = getRefreshInterval();
    setRefreshInterval(savedInterval);

    // 서버 상태 체크도 주기적으로 실행
    setInterval(() => {
        if (typeof checkServerStatus === 'function') {
            checkServerStatus();
        }
    }, 30000); // 30초마다

    // 즉시 한 번 실행
    if (typeof checkServerStatus === 'function') {
        checkServerStatus();
    }
}

// 숫자 포맷팅 (천단위 콤마)
function formatNumber(num) {
    return parseInt(num).toLocaleString();
}

// 날짜 포맷팅
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 디바운스 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 배열에서 중복 제거
function uniqueArray(arr) {
    return [...new Set(arr)];
}

// 객체 깊은 복사
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}