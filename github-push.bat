@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d "%~dp0"

echo ==========================================
echo  CPLA Quiz - GitHub Push
echo ==========================================
echo.

REM Check git
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed.
  echo Download: https://git-scm.com/download/win
  pause
  exit /b 1
)

REM Git config (local to repo)
git config user.email "prolab-PMP@users.noreply.github.com"
git config user.name "prolab-PMP"

REM Initialize repo if needed
if not exist .git (
  git init
  git branch -M main
)

REM Re-attach remote
git remote remove origin 2>nul
git remote add origin https://github.com/prolab-PMP/cpla-quiz.git

REM Stage, commit, push
git add -A
git commit -m "Initial commit: 공인노무사 1차 기출문제 풀이 사이트"
git branch -M main
git push -u origin main --force

echo.
echo ==========================================
echo  Push finished.
echo  Check: https://github.com/prolab-PMP/cpla-quiz
echo ==========================================
pause
