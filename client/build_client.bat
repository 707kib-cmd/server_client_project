@echo off
cd /d %~dp0

:: 로그
echo [🔄 최신 client.py 빌드 + 실행 시작]

:: 💥 실행 중인 client.exe 강제 종료
taskkill /f /im client.exe > nul 2>&1

:: 🔥 이전 빌드 결과물 삭제
rmdir /s /q build
rmdir /s /q dist
del client.spec > nul 2>&1

:: 💡 PyInstaller로 빌드
pyinstaller --noconsole --onefile client.py

:: ✅ 빌드 성공 여부 확인
if exist dist\client.exe (
    echo [✅ 빌드 완료됨: dist\client.exe]

    :: 로그 파일 제거 (선택사항)
    del client_debug.log > nul 2>&1

    :: ✨ client.exe 실행!
    echo [🚀 클라이언트 실행 중...]
    start "" dist\client.exe 8888 send PC-101 127.0.0.1
) else (
    echo [❌ dist\client.exe 가 생성되지 않음 — 빌드 실패]
)

pause