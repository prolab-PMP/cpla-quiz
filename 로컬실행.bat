@echo off
chcp 65001 >nul
title 공인노무사 Quiz - 로컬 서버
echo ========================================
echo  공인노무사 Quiz v2 로컬 서버 실행
echo ========================================
echo.
cd /d "%~dp0"

REM node_modules 확인
if not exist node_modules (
  echo [INFO] node_modules 설치 중...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install 실패. Node.js 설치 여부를 확인하세요.
    pause
    exit /b 1
  )
)

echo [INFO] 서버 시작...
echo.
echo  브라우저에서 접속: http://localhost:3000
echo  마스터 계정: %USERPROFILE% 에 저장된 .env 의 MASTER_EMAIL / MASTER_PASSWORD
echo.
echo  종료하려면 Ctrl+C 를 누르세요.
echo ----------------------------------------
node server.js
pause
