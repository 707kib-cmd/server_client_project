// ═══════════════════════════════════════════════════════════════════════════════════════════
// 📝 Modals - Templates Module - INI 템플릿 관리 기능
// ═══════════════════════════════════════════════════════════════════════════════════════════

// 기본 INI 템플릿들
const iniTemplates = {
    'VM_Flow_START': `[Commands]
action=START
target=VM_Flow_LoY.exe
priority=HIGH
delay=1000

[Settings]
auto_retry=true
retry_count=3
timeout=30000`,

    'VM_Flow_STOP': `[Commands]
action=STOP
target=VM_Flow_LoY.exe
force_kill=true

[Settings]
timeout=5000`,

    'VM_Flow_RESTART': `[Commands]
action=RESTART
target=VM_Flow_LoY.exe
priority=HIGH
delay=2000

[Settings]
auto_retry=true
retry_count=2
timeout=45000`,

    'SYSTEM_REBOOT': `[Commands]
action=REBOOT
delay=5000

[Settings]
force=true
timeout=60000`,

    'CUSTOM_SCRIPT': `[Commands]
action=SCRIPT
script_path=custom_script.bat
args=--verbose

[Settings]
timeout=30000
working_dir=C:\\Scripts`
};

// 템플릿 로드
function loadTemplate(templateName) {
    const textarea = document.getElementById('iniContent');
    if (!textarea) return;

    let content = '';

    // 기본 템플릿 확인
    if (iniTemplates[templateName]) {
        content = iniTemplates[templateName];
    }
    // 커스텀 템플릿 확인
    else if (getCustomTemplates()[templateName]) {
        content = getCustomTemplates()[templateName];
    }

    if (content) {
        textarea.value = content;
        setCurrentEditingTemplate(templateName);
        updateTemplateButtonSelection();
        console.log(`템플릿 로드됨: ${templateName}`);
    }
}

// 템플릿 저장
function saveTemplate() {
    const content = document.getElementById('iniContent')?.value.trim();
    if (!content) {
        alert('저장할 내용이 없습니다.');
        return;
    }

    let templateName = getCurrentEditingTemplate();

    // 새 템플릿인 경우 이름 입력받기
    if (!templateName || iniTemplates[templateName]) {
        templateName = prompt('템플릿 이름을 입력하세요:');
        if (!templateName) return;

        // 기본 템플릿과 중복 체크
        if (iniTemplates[templateName]) {
            alert('기본 템플릿과 같은 이름은 사용할 수 없습니다.');
            return;
        }
    }

    // 커스텀 템플릿에 저장
    const templates = getCustomTemplates();
    templates[templateName] = content;
    setCustomTemplates(templates);

    setCurrentEditingTemplate(templateName);
    updateTemplateButtons();
    updateTemplateButtonSelection();

    alert(`템플릿 '${templateName}'이 저장되었습니다.`);
}

// 템플릿 삭제
function deleteTemplate() {
    const templateName = getCurrentEditingTemplate();
    if (!templateName) {
        alert('삭제할 템플릿이 선택되지 않았습니다.');
        return;
    }

    // 기본 템플릿은 삭제 불가
    if (iniTemplates[templateName]) {
        alert('기본 템플릿은 삭제할 수 없습니다.');
        return;
    }

    if (!confirm(`템플릿 '${templateName}'을 삭제하시겠습니까?`)) {
        return;
    }

    // 커스텀 템플릿에서 삭제
    const templates = getCustomTemplates();
    delete templates[templateName];
    setCustomTemplates(templates);

    setCurrentEditingTemplate(null);
    updateTemplateButtons();

    // 텍스트 영역 초기화
    const textarea = document.getElementById('iniContent');
    if (textarea) {
        textarea.value = '';
    }

    alert(`템플릿 '${templateName}'이 삭제되었습니다.`);
}

// 새 템플릿 추가
function addNewTemplate() {
    const templateName = prompt('새 템플릿 이름을 입력하세요:');
    if (!templateName) return;

    // 중복 체크
    if (iniTemplates[templateName] || getCustomTemplates()[templateName]) {
        alert('이미 존재하는 템플릿 이름입니다.');
        return;
    }

    // 기본 내용으로 초기화
    const defaultContent = `[Commands]
action=
target=
priority=NORMAL

[Settings]
timeout=30000`;

    const textarea = document.getElementById('iniContent');
    if (textarea) {
        textarea.value = defaultContent;
    }

    setCurrentEditingTemplate(templateName);
    updateTemplateButtonSelection();
}

// 템플릿 내용 초기화
function clearTemplate() {
    if (!confirm('현재 내용을 모두 지우시겠습니까?')) {
        return;
    }

    const textarea = document.getElementById('iniContent');
    if (textarea) {
        textarea.value = '';
    }

    setCurrentEditingTemplate(null);
    updateTemplateButtonSelection();
}

// 템플릿 버튼들 업데이트
function updateTemplateButtons() {
    const container = document.querySelector('.template-buttons');
    if (!container) return;

    container.innerHTML = '';

    // 기본 템플릿 버튼들
    Object.keys(iniTemplates).forEach(templateName => {
        const button = document.createElement('button');
        button.textContent = templateName;
        button.className = 'template-btn default-template';
        button.onclick = () => loadTemplate(templateName);
        container.appendChild(button);
    });

    // 구분선
    if (Object.keys(getCustomTemplates()).length > 0) {
        const separator = document.createElement('hr');
        separator.style.margin = '8px 0';
        container.appendChild(separator);
    }

    // 커스텀 템플릿 버튼들
    Object.keys(getCustomTemplates()).forEach(templateName => {
        const button = document.createElement('button');
        button.textContent = templateName;
        button.className = 'template-btn custom-template';
        button.onclick = () => loadTemplate(templateName);
        container.appendChild(button);
    });

    // 새 템플릿 추가 버튼
    const addButton = document.createElement('button');
    addButton.textContent = '+ 새 템플릿';
    addButton.className = 'template-btn add-template';
    addButton.onclick = addNewTemplate;
    container.appendChild(addButton);
}

// 템플릿 버튼 선택 상태 업데이트
function updateTemplateButtonSelection() {
    const currentTemplate = getCurrentEditingTemplate();
    const buttons = document.querySelectorAll('.template-btn');

    buttons.forEach(button => {
        if (button.textContent === currentTemplate) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// 템플릿 내보내기
function exportTemplates() {
    const templates = getCustomTemplates();
    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'ini_templates.json';
    link.click();
}

// 템플릿 가져오기
function importTemplates() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (typeof imported !== 'object') {
                    throw new Error('잘못된 형식입니다.');
                }

                const current = getCustomTemplates();
                const merged = { ...current, ...imported };
                setCustomTemplates(merged);

                updateTemplateButtons();
                alert(`${Object.keys(imported).length}개의 템플릿을 가져왔습니다.`);
            } catch (error) {
                alert('파일을 읽는 중 오류가 발생했습니다: ' + error.message);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

// 템플릿 검색
function searchTemplates(keyword) {
    const buttons = document.querySelectorAll('.template-btn');
    keyword = keyword.toLowerCase();

    buttons.forEach(button => {
        const templateName = button.textContent.toLowerCase();
        if (templateName.includes(keyword) || keyword === '') {
            button.style.display = 'inline-block';
        } else {
            button.style.display = 'none';
        }
    });
}