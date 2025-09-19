
// ✅ 상태값
let condensed = false;
let serverFilter = null;

// ✅ 유틸 함수
    function trimTimestamp(ts) {
      return ts.replace(/^20\d\d-/, '');
    }

	function getThresholdMs() {
	  const el = document.getElementById("threshold");
	  if (!el) return 300000; // 기본값: 5분

	  return parseInt(el.value) * 60 * 1000;
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

  const historyBtn = `<button onclick="showDiaHistory()" style="font-size: 0.8em; padding: 2px 6px; margin-left: 6px;">📅 추적</button>`;

  const html = `다이아 합산 → ${serverLinks} | ${allLink} ${historyBtn}`;

  document.getElementById("serverSummary").innerHTML = html;
}

    function getClientOrder() {
      return JSON.parse(localStorage.getItem("clientOrder") || "[]");
    }

    function setClientOrder(order) {
      localStorage.setItem("clientOrder", JSON.stringify(order));
    }

function fetchClients() {
  const threshold = getThresholdMs();
  const now = Date.now();
  const clientOrder = getClientOrder();

  fetch("/api/clients")
    .then(res => res.json())
    .then(data => {
      updateServerSummary(data);
      const grid = document.getElementById("dashboard");

      const clientMap = {};
      data.forEach(c => clientMap[c.name] = c);

      const names = clientOrder.length > 0 ? clientOrder : data.map(c => c.name);

names.forEach(name => {
  const existing = grid.querySelector(`.card[data-name="${name}"]`);

  // ✅ 이미 있는 카드라면 모드 전환용 내용 업데이트만 해주기
  if (existing) {
    const c = clientMap[name];
    if (c && !existing.classList.contains("empty")) {
      existing.innerHTML = condensed ? `
        <div class="name">${c.name}</div>
        <div class="info">
          ${c.server}<br>${c.dia}
        </div>
      ` : `
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
    return; // ✅ 새로 생성 안 함
  }

  const c = clientMap[name];
  const card = document.createElement("div");
  card.setAttribute("data-name", name);

  if (!c) {
    // 🧊 빈 카드 자리
    card.className = "card empty";
    card.setAttribute("data-server", "");
    card.innerHTML = `
      <div class="delete-btn" onclick="deleteCard('${name}')">삭제</div>
      <div class="name">🧊 ${name}</div>
      <div class="info">[미동작 자리]</div>
    `;
  } else {
    const age = now - new Date(c.last_report).getTime();
    const barColor = age < threshold ? '#28a745' : '#dc3545';

    card.className = "card";
    card.setAttribute("data-server", c.server);
    card.style.borderLeftColor = barColor;

    card.innerHTML = condensed ? `
      <div class="name">${c.name}</div>
      <div class="info">
        ${c.server}<br>${c.dia}
      </div>
    ` : `
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

  grid.appendChild(card);
});




      Sortable.create(grid, {
        animation: 150,
        swap: true,
        swapClass: "highlight",
        onEnd: () => {
          const newOrder = Array.from(grid.children).map(c => c.dataset.name);
          setClientOrder(newOrder);
        }
      });
	(function storeDailyDiaStats() {
	  const today = new Date().toISOString().slice(0, 10);
	  const dataMap = JSON.parse(localStorage.getItem("dailyDiaStats") || "{}");
	  if (dataMap[today]) return;

	  const stats = {
		TOTAL: 0,
		SERVER_SUM: {},
		COUNT_BY_SERVER: {}
	  };

	  names.forEach(name => {
		const c = clientMap[name];
		if (!c || !c.dia || !c.server) return;

		const dia = Number(c.dia);
		stats[name] = dia;
		stats.TOTAL += dia;
		stats.SERVER_SUM[c.server] = (stats.SERVER_SUM[c.server] || 0) + dia;
		stats.COUNT_BY_SERVER[c.server] = (stats.COUNT_BY_SERVER[c.server] || 0) + 1;
	  });

	  dataMap[today] = stats;
	  localStorage.setItem("dailyDiaStats", JSON.stringify(dataMap));
	})();

	// 👉 그리고 나서 필터 적용
	applyFilters();	
    });
}

function applyFilters() {
  const q = document.getElementById("searchInput")?.value.trim().toLowerCase();
  const minDia = parseInt(document.getElementById("minDiaInput")?.value || "0");
  const server = serverFilter;

  document.querySelectorAll(".card").forEach(card => {
    const isEmpty = card.classList.contains("empty");
    const serverName = card.dataset.server || "";
    const fullText = card.textContent.toLowerCase();

    const matchesText = !q || fullText.includes(q);
    const matchesServer = !server || isEmpty || serverName === server;

    let matchesDia = true;

if (!isEmpty && minDia > 0) {
  const info = card.querySelector(".info")?.innerText || "";
  const lines = info.split("\n").map(line => line.trim()).filter(Boolean);

  // 다이아 수량은 세 번째 줄 (index 2)
  const diaLine = lines[2] || "";
  const diaValue = parseInt(diaLine.replace(/,/g, ""));

  matchesDia = !isNaN(diaValue) && diaValue >= minDia;

  // 🔍 디버깅 로그
  console.log("💎 다이아:", diaValue, "| 입력값:", minDia, "| 통과 여부:", matchesDia);
}

    const shouldDisplay = matchesText;

    card.classList.remove("ghost-card");

    if (shouldDisplay) {
      card.style.display = "";
      const shouldGhost = !matchesServer || !matchesDia;
      if (shouldGhost) card.classList.add("ghost-card");
    } else {
      card.style.display = "none";
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

    function deleteCard(name) {
      const grid = document.getElementById("dashboard");
      const card = grid.querySelector(`[data-name="${name}"]`);
      if (card) grid.removeChild(card);
      const newOrder = Array.from(grid.children).map(c => c.dataset.name);
      setClientOrder(newOrder);
    }

    fetchClients();
    setInterval(fetchClients, 5000);

    function showDiaHistory() {
	  const win = window.open("", "DiaHistoryWindow", "width=1920,height=1080,resizable=yes,scrollbars=yes");
	  if (!win) return alert("📦 팝업 차단을 해제해주세요!");

	  win.document.title = "📅 다이아 수량 추적 기록";

	  win.document.head.innerHTML = `
		<style>
		  body {
			margin: 0;
			padding: 24px;
			background: #fff;
			font-family: 'Segoe UI', sans-serif;
			color: #333;
			max-width: 1080px;
			margin: auto;
		  }
		  h1 {
			font-size: 1.4em;
			margin-bottom: 6px;
		  }
		  .entry {
			display: flex;
			justify-content: space-between;
			padding: 6px 0;
			border-bottom: 1px dashed #eee;
			font-size: 0.9em;
		  }
		  .entry .label { font-weight: bold; }
		  .diff.up { color: #28a745; font-weight: bold; }
		  .diff.down { color: #dc3545; font-weight: bold; }
		  .diff.zero { color: #aaa; }
		</style>
	  `;

	  win.document.body.innerHTML = `
		<h1>📅 다이아 수량 추적 기록</h1>
		<div id="diaHistoryContent">
		  <p style="text-align: center; opacity: 0.6;">(데이터 준비 중입니다...)</p>
		</div>
	  `;
        win.renderDiaHistoryContent = renderDiaHistoryContent;
        setTimeout(() => {
          win.renderDiaHistoryContent(win); // ⏱ 호출만 살짝 딜레이!
        }, 50);


	  // ✨ 데이터 출력은 추후 여기에 추가 가능!
	}	
	
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

function renderDiaHistoryContent(win, server = null, keyword = "") {
  const contentEl = win.document.getElementById("diaHistoryContent");
  contentEl.innerHTML = "⏳ 데이터 불러오는 중...";

  const raw = localStorage.getItem("dailyDiaStats");

  const diaHistory = JSON.parse(raw || "{}"); // ✅ 이 줄 추가!


  function highlightKeyword(text, keyword) {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, "gi");
  return text.replace(regex, '<mark>$1</mark>');
}

function renderSparkline(values) {
  if (!values || values.length === 0) return "";

  const chars = "▁▂▃▄▅▆▇█";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return chars[0].repeat(values.length);

  return values.map(val => {
    const i = Math.floor((val - min) / (max - min) * (chars.length - 1));
    return chars[i];
  }).join("");
}

  if (!raw) {
    contentEl.innerHTML = "⚠️ 저장된 데이터가 없습니다!";
    return;
  }

  const dataMap = JSON.parse(raw);
  const dates = Object.keys(dataMap).sort().reverse();

  let html = "";
  let prevSnapshot = {};
  let allNames = new Set();

  const searchText = (keyword || "").trim().toLowerCase();

  for (const date of dates) {
    const daily = dataMap[date];
    let sum = 0;
    let clientLines = "";
    let upList = [];
    let downList = [];

    for (const [name, count] of Object.entries(daily)) {
      if (["TOTAL", "SERVER_SUM", "COUNT_BY_SERVER"].includes(name)) continue;

      // ✅ 서버 필터 적용
      if (server && !name.startsWith(server + "-")) continue;

      // ✅ 검색어 필터 적용
      if (searchText && !name.toLowerCase().includes(searchText)) continue;

      console.log("[PASS]", name, "|", keyword);

      allNames.add(name);
      const prev = prevSnapshot[name];
      const delta = prev != null ? count - prev : null;

      const highlighted = highlightKeyword(name, searchText);
      const spark = renderSparkline(diaHistory[name] || []);
      let line = `${highlighted} <span class="spark">${spark}</span> <strong>${count.toLocaleString()}</strong>`;

      if (delta != null) {
        if (delta > 0) line += ` 🔺 +${delta.toLocaleString()}`;
        else if (delta < 0) line += ` 🔻 ${delta.toLocaleString()}`;
        else line += ` –`;
      } else {
        line += ` –`;
      }

      if (delta != null && delta > 0) upList.push({ name, delta });
      if (delta != null && delta < 0) downList.push({ name, delta });

      sum += count;
      clientLines += `<div>${line}</div>`;
    }

    if (!clientLines) continue; // 🔒 이 날짜에 출력할 클라 없음

    html += `
      <h3>${date}</h3>
      <div>전체 합산 <strong>${sum.toLocaleString()}</strong></div>
      ${clientLines}
    `;

    if (upList.length > 0) {
      const topUps = upList.sort((a, b) => b.delta - a.delta).slice(0, 3);
      html += `<div>📌 상승 클라 TOP 3<br/>${topUps.map(u => `${u.name} 🔺 +${u.delta.toLocaleString()}`).join("<br/>")}</div>`;
    }

    if (downList.length > 0) {
      const topDowns = downList.sort((a, b) => a.delta - b.delta).slice(0, 3);
      html += `<div>📉 하락 클라 TOP 3<br/>${topDowns.map(d => `${d.name} 🔻 ${d.delta.toLocaleString()}`).join("<br/>")}</div>`;
    }

    html += `<hr style="margin:10px 0;">`;
    prevSnapshot = daily;
  }

  contentEl.innerHTML = html || "😶 출력할 데이터가 없습니다!";
}

function showDiaHistory() {
  const win = window.open("", "DiaHistoryWindow", "width=1920,height=1080,resizable=yes,scrollbars=yes");
  if (!win) return alert("📦 팝업 차단을 해제해주세요!");
  win.document.title = "📅 다이아 수량 추적 기록";

  win.document.body.innerHTML = `
    <input id="searchClient" placeholder="🔍 클라이언트 검색..."
      oninput="filterClientName(window)"
      style="padding: 6px; margin: 12px 0 4px 0; width: 240px; font-size: 0.9em;" />

    <div id="suggestList"
      style="max-height: 120px; overflow-y: auto; margin-bottom: 10px; display: none;"></div>

    <div id="serverFilter" style="margin-bottom: 12px;"></div>

    <h1>📅 다이아 수량 추적 기록</h1>
    <div id="diaHistoryContent">⏳ 데이터 불러오는 중...</div>

    <h2>📊 TOTAL 추세 그래프</h2>
    <div class="chart-toolbar" style="text-align: center; margin-bottom: 8px;">
      <button onclick="renderTotalTrendChart(3, window)">최근 3일</button>
      <button onclick="renderTotalTrendChart(7, window)">최근 7일</button>
      <button onclick="renderTotalTrendChart(30, window)">최근 30일</button>
      <button onclick="renderTotalTrendChart(999, window)">전체</button>
    </div>
    
    <canvas id="totalTrendChart" width="600" height="200"></canvas>

    <div style="display: flex; justify-content: center;">
      <canvas id="totalTrendChart" width="800" height="360"
        style="background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></canvas>
    </div>

    <h2>📊 서버별 추세선</h2>
    <div style="text-align: center; margin-bottom: 8px;">
      <button onclick="renderServerTrendChart(3, window)">최근 3일</button>
      <button onclick="renderServerTrendChart(7, window)">최근 7일</button>
      <button onclick="renderServerTrendChart(30, window)">최근 30일</button>
      <button onclick="renderServerTrendChart(999, window)">전체</button>
    </div>
    <div style="display: flex; justify-content: center;">
      <canvas id="serverTrendChart" width="800" height="360"
        style="background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></canvas>
    </div>
  `;

  // ✅ 서버 필터 버튼 생성
  const serverDiv = win.document.getElementById("serverFilter");

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
  win.filterClientName = function(win = window) {
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
      const items = suggestBox.querySelectorAll(".suggest-item");
      items.forEach((el, i) => {
        el.style.background = i === index ? "#ddd" : "";
      });
    }
  }, 300);

  // ✅ 함수들 먼저 주입
  win.renderDiaHistoryContent = renderDiaHistoryContent;
  win.renderTotalTrendChart = renderTotalTrendChart;
  win.renderServerTrendChart = renderServerTrendChart;

  // ✅ 그다음 호출
  win.renderDiaHistoryContent(win);
  win.renderTotalTrendChart(7, win);
  win.renderServerTrendChart(7, win);
}

//그래프 렌더 함수
function renderTotalTrendChart(days = 7, win = window) {
  const raw = localStorage.getItem("dailyDiaStats");
  if (!raw) return;

  const dataMap = JSON.parse(raw);
  const today = new Date();
  const labels = [];
  const totals = [];

  Object.keys(dataMap)
    .sort()
    .forEach(date => {
      const diff = (today - new Date(date)) / (1000 * 60 * 60 * 24);
      if (diff <= days) {
        labels.push(date);
        totals.push(dataMap[date].TOTAL || 0);
      }
    });

  // ✅ 먼저 ctx 정의 & 존재 여부 확인
  // 📈 서버 트렌드용
  const serverCtx = win.document.getElementById("serverTrendChart")?.getContext("2d");
  if (!serverCtx) return;

  // 📊 전체 트렌드용
  const totalCtx = win.document.getElementById("totalTrendChart")?.getContext("2d");
  if (!totalCtx) return;

  // ✅ 이전 차트 제거 (필요한 경우)
  if (win.totalChart) win.totalChart.destroy();

  // ✅ 그다음에 Chart 생성
  win.totalChart = new Chart(totalCtx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "전체 다이아 총합",
        data: totals,
        borderColor: "#007bff",
        backgroundColor: "rgba(0,123,255,0.1)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => value.toLocaleString()
          }
        }
      }
    }
  });
}

function renderServerTrendChart(days = 7, win = window) {
  const raw = localStorage.getItem("dailyDiaStats");
  if (!raw) return;

  const dataMap = JSON.parse(raw);
  const today = new Date();
  const labels = [];
  const serverNames = new Set();
  const serverTotalsByDay = {};

  // 날짜 필터링 + 서버별 누적값 수집
  Object.keys(dataMap)
    .sort()
    .forEach(date => {
      const diff = (today - new Date(date)) / (1000 * 60 * 60 * 24);
      if (diff <= days) {
        labels.push(date);

        const serverData = dataMap[date] || {};
        serverTotalsByDay[date] = {};

        Object.entries(serverData).forEach(([server, value]) => {
          serverNames.add(server);
          serverTotalsByDay[date][server] = value;
        });
      }
    });

  // 각 서버별 데이터 배열 생성
  const datasets = Array.from(serverNames).map(server => {
    const data = labels.map(date => serverTotalsByDay[date]?.[server] || 0);
    const color = randomColor();

    return {
      label: server,
      data,
      borderColor: color,
      backgroundColor: color + "33",
      fill: false,
      tension: 0.3
    };
  });

  // ✅ 서버 트렌드용 캔버스 사용
  const serverCtx = win.document.getElementById("serverTrendChart")?.getContext("2d");
  if (!serverCtx) return;

  // ✅ 디버깅용 로그
  console.log("📅 labels:", labels);
  console.log("📈 datasets:", datasets);

  // ✅ 기존 차트 제거
  if (win.serverChart) win.serverChart.destroy();

  // ✅ 서버 차트 생성
  win.serverChart = new Chart(serverCtx, {
    type: "line",
    data: {
      labels,
      datasets
    },
    options: {
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => value.toLocaleString()
          }
        }
      }
    }
  });
}

// 🌈 랜덤 색상 생성 함수
function randomColor() {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 180);
  const b = Math.floor(Math.random() * 220);
  return `rgb(${r},${g},${b})`;
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
      const items = suggestDiv.querySelectorAll(".suggest-item");
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
          win.renderDiaHistoryContent(win);
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
      el.style.background = i === index ? "#ddd" : "";
    });
  }
}