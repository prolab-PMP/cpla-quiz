@echo off
cd /d "%~dp0"
echo ==========================================
echo  cpla-quiz - GitHub Push
echo ==========================================
echo [start] %date% %time% > push-log.txt
git config user.email "prolab-PMP@users.noreply.github.com"
git config user.name "prolab-PMP"
git add -A >> push-log.txt 2>&1
git commit -m "update site" >> push-log.txt 2>&1
git push origin main >> push-log.txt 2>&1
if errorlevel 1 (
  echo [FAIL] push failed. See push-log.txt
) else (
  echo [OK] Push finished: https://github.com/prolab-PMP/cpla-quiz
)
git log --oneline -1 >> push-log.txt 2>&1
echo [end] %date% %time% >> push-log.txt
pause
