# 🌐 웹 분석 (WEB ANALYSIS)

## 📋 개요
Flask 웹서버 (포트 8000) + JavaScript 프론트엔드 실시간 대시보드

---

## 🐍 Flask 서버 (app.py)

### 라우트 구조
```python
@app.route('/')                    # 메인 대시보드 페이지
@app.route('/api/clients')         # 클라이언트 상태 JSON API
@app.route('/dia-history')         # 다이아 히스토리 페이지
@app.route('/api/dia-history')     # 히스토리 데이터 JSON API
```

### API 응답 형식
```json
// /api/clients
[{
  "name": "NC-테오필-01", "ip": "192.168.1.100",
  "game": "NC", "server": "테오필", "dia": 50000,
  "last_report": "2025-01-14 15:30:00", "status": "alive"
}]

// /api/dia-history?days=7
{
  "2025-01-14": {
    "NC-테오필-01": {"today": 50000, "diff": 1000, "game": "NC"},
    "TOTAL": 150000
  }
}
```

---

## 📜 JavaScript (dashboard.js)

### 핵심 함수
```javascript
fetchClients()               # 5초마다 API 호출, 카드 UI 업데이트
updateServerSummary(data)    # 서버별 다이아 합계 표시
applyFilters()               # 3단계 필터링 (텍스트/서버/다이아)
generateSparkline(values)    # 유니코드 블록으로 미니차트 생성
```

### AJAX 통신
```javascript
// 실시간 데이터 갱신
const res = await fetch("/api/clients");
const data = await res.json();
updateCards(data);

// 5초마다 자동 갱신
setInterval(fetchClients, 5000);
```

### DOM 조작
```javascript
// 카드 동적 생성
const card = document.createElement("div");
card.className = c ? "card" : "card empty";
card.dataset.name = name;
card.innerHTML = condensed ? 간결모드 : 전체모드;
```

### 드래그 앤 드롭
```javascript
// Sortable.js 사용
Sortable.create(grid, {
    animation: 150, swap: true,
    onEnd: () => setClientOrder(newOrder)  // localStorage 저장
});
```

### 필터링 시스템
```javascript
// 3단계 필터
1. 텍스트 검색: fullText.includes(query)
2. 서버 필터: serverName === serverFilter
3. 다이아 필터: parseInt(card.dataset.dia) >= minDia

// UI 효과
display: none        # 텍스트 불일치 (완전 숨김)
ghost-card 클래스    # 서버/다이아 불일치 (반투명)
```

---

## 🏗️ HTML 구조

### dashboard.html
```html
<div class="grid" id="dashboard">           <!-- 카드 컨테이너 -->
<input id="searchInput" />                  <!-- 텍스트 검색 -->
<input id="minDiaInput" type="number" />    <!-- 다이아 필터 -->
<select id="threshold">                     <!-- 온라인/오프라인 임계값 -->
<div class="server-summary" />              <!-- 서버별 합계 -->
```

### dia-history.html
```html
<div class="layout">
  <div class="history-column">              <!-- 좌측: 일별 리스트 -->
  <div class="chart-column">                <!-- 우측: Chart.js 차트 -->
    <canvas id="totalTrendChart" />
    <canvas id="serverTrendChart" />
```

### CSS 특징
```css
.grid { display: flex; flex-wrap: wrap; }
.card {
    width: calc((100% - 19 * 4px) / 20);   /* 20개 카드 자동 폭 */
    border-left: 3px solid #555;           /* 상태 표시 바 */
}
.ghost-card { opacity: 0.25; filter: grayscale(60%); }
```

---

## 📊 차트 시스템 (Chart.js)

### TOTAL 트렌드
```javascript
renderTotalTrendChart(dayCount) {
    fetch(`/api/dia-history?days=${dayCount}`)
        .then(data => {
            const values = dates.map(date => dataMap[date].TOTAL);
            new Chart(ctx, { type: "line", data: {labels: dates, datasets: ...} });
        });
}
```

### 서버별 트렌드
```javascript
// 서버명 추출 → 다중 데이터셋 생성
const serverList = [...new Set(서버명들)];
const datasets = serverList.map(server => ({
    label: server, data: 서버별합계배열,
    borderColor: randomColor()
}));
```

### 스파크라인 (히스토리)
```javascript
// 유니코드 블록으로 14일 트렌드
const blocks = "▁▂▃▄▅▆▇█";
const sparkline = values.map(val => blocks[정규화된레벨]).join('');
```

---

## 🔄 실시간 업데이트 흐름

```
1. 페이지 로드 → fetchClients() 즉시 실행
2. setInterval(fetchClients, 5000) → 5초마다 반복
3. fetch("/api/clients") → Flask API 호출
4. SQLite 쿼리 → JSON 응답
5. 카드 DOM 업데이트 (기존 카드는 innerHTML만 변경)
6. Sortable.js 재초기화
7. applyFilters() → 필터 상태 유지
```

---

## 💾 로컬 스토리지 활용

```javascript
// 카드 순서 영구 저장
localStorage.setItem("clientOrder", JSON.stringify(order));

// 히스토리 데이터 캐싱
localStorage.setItem("dailyDiaStats", JSON.stringify(stats));
```

---

## ⚠️ 주요 문제점

### 1. 성능 이슈
- 5초마다 전체 카드 재생성 (비효율)
- 대량 데이터 시 DOM 조작 과부하

### 2. 오류 처리 부족
- fetch 실패 시 사용자 알림 없음
- 네트워크 단절 시 재시도 없음

### 3. 보안 취약점
- API 인증 없음
- XSS 방지 미흡

---

## 🚀 개선 제안

### 성능 최적화
```javascript
// 1. WebSocket 실시간 업데이트
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (event) => updateSingleCard(JSON.parse(event.data));

// 2. 가상 스크롤링 (많은 카드용)
class VirtualGrid {
    render(visibleItems) { /* 보이는 영역만 렌더링 */ }
}

// 3. 디바운싱
const debouncedFilter = debounce(applyFilters, 300);
```

### 사용자 경험 개선
```javascript
// 로딩 상태 표시
function showLoading() { /* 스피너 표시 */ }
function hideLoading() { /* 스피너 숨김 */ }

// 오류 토스트
function showError(message) { /* 오류 알림 */ }
```

### 보안 강화
```javascript
// XSS 방지
function sanitizeHtml(str) {
    return str.replace(/[<>]/g, (match) => ({'<': '&lt;', '>': '&gt;'}[match]));
}
```

---
**📅 분석일**: 2025-01-14 | **포트**: 8000