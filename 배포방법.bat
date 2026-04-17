@echo off
chcp 65001 >nul
echo ===================================
echo  공인노무사 Quiz 로컬 실행 방법
echo ===================================
echo.
echo 1. Node.js가 설치되어 있어야 합니다 (https://nodejs.org)
echo 2. 아래 명령어를 순서대로 실행하세요:
echo.
echo    cd "%~dp0"
echo    npm install
echo    node server.js
echo.
echo 3. 브라우저에서 http://localhost:3000 접속
echo.
echo ===================================
echo  Railway 배포 방법
echo ===================================
echo.
echo 1. https://railway.app 접속 후 로그인
echo 2. New Project > Deploy from GitHub repo
echo 3. 이 폴더를 GitHub에 push 후 연결
echo    또는 Railway CLI 사용: railway login 후 railway up
echo.
pause
cd /d "%~dp0"
npm install
node server.js
