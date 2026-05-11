@echo off
chcp 65001 >nul
echo ============================================
echo  SJ-360 APT VR 배포 시작
echo ============================================
echo.
cd /d "%~dp0"

echo [1/4] photos 폴더 스캔 및 busan.json 자동 갱신...
call node scripts\scan-photos.js
if errorlevel 1 (
  echo.
  echo [오류] 스캔 실패. Node.js가 설치되어 있는지 확인하세요.
  echo        https://nodejs.org 에서 LTS 버전 설치 후 재시도하세요.
  pause
  exit /b 1
)

echo.
echo [2/4] Git 변경사항 확인...
git status --short

echo.
echo [3/4] Git 커밋 + GitHub Push...
git add .
git commit -m "deploy: photos and data update" 2>nul || echo (변경사항 없음, 커밋 건너뜀)
git push origin main
if errorlevel 1 (
  echo.
  echo [경고] Git push 실패. 인터넷 연결 또는 인증을 확인하세요.
  echo         Cloudflare 배포는 계속 진행합니다.
)

echo.
echo [4/4] Cloudflare Pages 배포...
call npx wrangler pages deploy public --project-name=sj-360-apt-vr --branch=main --commit-dirty=true
if errorlevel 1 (
  echo.
  echo [오류] Cloudflare 배포 실패.
  echo        npx wrangler whoami 로 인증 상태를 확인하세요.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  배포 완료!
echo  https://sj-360-apt-vr.pages.dev/
echo ============================================
pause
