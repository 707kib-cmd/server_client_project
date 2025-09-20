// ═══════════════════════════════════════════════════════════════════════════════════════════
// 📊 Charts - Dia History Module - 다이아 히스토리 차트 및 관련 기능
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 다이아 히스토리 콘텐츠 렌더링
function renderDiaHistoryContent(win, server = null, name = null) {
    // 1) 다이아 히스토리 페이지 초기화 (dia-history.html)
    const dia = document.getElementById("diaHistoryContent");
    if (dia) {
        // API에서 7일치 히스토리 데이터 가져오기
        fetch(getApiUrl("/api/dia-history?days=7"))
            .then(res => res.json())
            .then(stats => {
                console.log("❇️ /api/dia-history 응답:", stats);
                // 로컬스토리지에 저장
                localStorage.setItem("dailyDiaStats", JSON.stringify(stats));

                // 실제 렌더링 수행
                renderDiaHistoryFromData(stats, server, name);
            })
            .catch(err => {
                console.error("❌ dia-history API 호출 실패:", err);
                dia.innerHTML = "<div class='history-text'>❌ 데이터 로딩 실패</div>";
            });
    }
}

// 데이터를 받아서 실제 렌더링
function renderDiaHistoryFromData(stats, serverFilter = null, nameFilter = null) {
    const dia = document.getElementById("diaHistoryContent");
    if (!dia) return;

    // 날짜순 정렬 (최신순)
    const sortedDates = Object.keys(stats).sort().reverse();

    let content = "<div class='history-text'>📅 다이아 수량 추적 기록</div>";

    sortedDates.forEach(date => {
        const dayData = stats[date];
        const clientNames = Object.keys(dayData).filter(name =>
            !["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(name)
        );

        // 서버 필터 적용
        const filteredNames = serverFilter ?
            clientNames.filter(name => name.startsWith(serverFilter + "-")) :
            clientNames;

        // 이름 필터 적용
        const finalNames = nameFilter ?
            filteredNames.filter(name => name.toLowerCase().includes(nameFilter.toLowerCase())) :
            filteredNames;

        if (finalNames.length === 0) return;

        content += `<div class='date-section'>`;
        content += `<h3>${date} (${finalNames.length}개)</h3>`;

        finalNames.forEach(clientName => {
            const client = dayData[clientName];
            if (!client) return;

            const diffStr = client.diff > 0 ? `+${client.diff}` :
                client.diff < 0 ? `${client.diff}` : "±0";
            const diffClass = client.diff > 0 ? "positive" :
                client.diff < 0 ? "negative" : "neutral";

            // 스파크라인 생성을 위한 더미 데이터 (실제로는 여러 날짜 데이터 필요)
            const sparkData = [client.today - 100, client.today - 50, client.today];
            const sparkline = generateSparkline(sparkData);

            content += `
                <div class="client-line">
                    <div>
                        <strong>${clientName}</strong>
                        [${client.server}/${client.game}]
                        ${client.today.toLocaleString()}💎
                        <span class="${diffClass}">(${diffStr})</span>
                    </div>
                    <div class="sparkline">${sparkline}</div>
                </div>
            `;
        });

        content += `</div>`;
    });

    dia.innerHTML = content;
}

// TOTAL 추세 차트 렌더링
function renderTotalTrendChart(dayCount, win = window) {
    const canvas = win.document.getElementById("totalTrendChart");
    if (!canvas) return;

    if (!win.chartStore) win.chartStore = {};

    // fetch 직전에 URL 확인
    const totalUrl = getApiUrl(`/api/dia-history?days=${dayCount}`);
    console.log("▶ [TOTAL] About to fetch URL:", totalUrl);

    fetch(totalUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            console.log("▶ [TOTAL] 차트 데이터 받음:", data);

            // 기존 차트 제거
            if (win.chartStore.totalChart) {
                win.chartStore.totalChart.destroy();
            }

            // 날짜별 TOTAL 데이터 추출
            const dates = Object.keys(data).sort();
            const totals = dates.map(date => data[date]["TOTAL"] || 0);

            const ctx = canvas.getContext('2d');
            win.chartStore.totalChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates.map(d => d.split('-').slice(1).join('/')), // MM/DD 형태
                    datasets: [{
                        label: 'TOTAL 다이아',
                        data: totals,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0,123,255,0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function (value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(err => {
            console.error("❌ TOTAL 차트 렌더링 실패:", err);
        });
}

// 서버별 추세 차트 렌더링
function renderServerTrendChart(dayCount, win = window) {
    const canvas = win.document.getElementById("serverTrendChart");
    if (!canvas) return;

    if (!win.chartStore) win.chartStore = {};

    // fetch 직전에 URL 확인
    const serverUrl = getApiUrl(`/api/dia-history?days=${dayCount}`);
    console.log("▶ [SERVER] About to fetch URL:", serverUrl);

    fetch(serverUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            console.log("▶ [SERVER] 차트 데이터 받음:", data);

            // 기존 차트 제거
            if (win.chartStore.serverChart) {
                win.chartStore.serverChart.destroy();
            }

            // 서버별 데이터 집계
            const dates = Object.keys(data).sort();
            const serverTotals = {};

            dates.forEach(date => {
                const dayData = data[date];
                Object.keys(dayData).forEach(clientName => {
                    if (!["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(clientName)) {
                        const server = clientName.split('-')[0];
                        if (!serverTotals[server]) {
                            serverTotals[server] = {};
                        }
                        if (!serverTotals[server][date]) {
                            serverTotals[server][date] = 0;
                        }
                        serverTotals[server][date] += dayData[clientName].today || 0;
                    }
                });
            });

            // Chart.js 데이터셋 생성
            const colors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0'];
            const datasets = Object.keys(serverTotals).map((server, index) => ({
                label: server,
                data: dates.map(date => serverTotals[server][date] || 0),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            }));

            const ctx = canvas.getContext('2d');
            win.chartStore.serverChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates.map(d => d.split('-').slice(1).join('/')),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function (value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(err => {
            console.error("❌ SERVER 차트 렌더링 실패:", err);
        });
}

// 다이아 히스토리 표시 (팝업 방식 - 레거시)
function showDiaHistory() {
    window.open('/dia-history', '_blank', 'width=1200,height=800');
}

// 클라이언트명 필터링 (자동완성)
function filterClientName(win = window) {
    const inputEl = win.document.getElementById("searchClient");
    const suggestDiv = win.document.getElementById("suggestList");
    if (!inputEl || !suggestDiv) return;
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
    let selectedIndex = -1;

    matched.forEach((name, i) => {
        const div = win.document.createElement("div");
        div.textContent = name;
        div.className = "suggest-item";
        div.onmouseover = () => updateHighlight(i);
        div.onmouseout = () => updateHighlight(-1);
        div.onclick = () => {
            inputEl.value = name;
            suggestDiv.style.display = "none";
            win.renderDiaHistoryContent(win, null, name);
        };
        suggestDiv.appendChild(div);
    });

    suggestDiv.style.display = matched.length ? "block" : "none";

    if (!inputEl._keyboardAttached) {
        inputEl.addEventListener("keydown", (e) => {
            const items = suggestDiv.querySelectorAll(".suggest-item");
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
                    inputEl.value = items[selectedIndex].textContent;
                    suggestDiv.style.display = "none";
                    win.renderDiaHistoryContent(win, null, inputEl.value);
                    selectedIndex = -1;
                }
            } else if (e.key === "Escape") {
                suggestDiv.style.display = "none";
                selectedIndex = -1;
            }
        });
        inputEl._keyboardAttached = true;
    }

    function updateHighlight(index) {
        const items = suggestDiv.querySelectorAll(".suggest-item");
        items.forEach((el, i) => {
            el.style.background = i === index ? "#ddd" : "";
        });
    }
}