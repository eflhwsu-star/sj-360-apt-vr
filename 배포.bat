@echo off
chcp 65001 >nul
echo ============================================
echo  SJ-360 APT VR Deploy
echo ============================================
echo.
cd /d "%~dp0"
echo Working directory: %CD%
echo.

echo [1/5] 원본 백업 확인 (photos-original/)...
if not exist "public\photos-original\" (
  echo   폴더 없음 - 최초 백업 생성 중...
  robocopy "public\photos" "public\photos-original" /E /XD optimized /NFL /NDL /NJH /NJS
  echo   백업 완료.
) else (
  echo   이미 존재함 - 백업 건너뜀.
)
echo.

echo [2/5] 워터마크 합성 (photos-original/ -> photos/)...
node scripts\watermark-photos.js
if errorlevel 1 (
  echo.
  echo [ERROR] watermark-photos.js failed.
  echo Please check: node_modules\sharp is installed (run: npm install)
  pause
  exit /b 1
)
echo.

echo [3/5] 추가 압축 v4 (2MB 이하 강제)...
node scripts\compress-photos.js
if errorlevel 1 (
  echo.
  echo [ERROR] compress-photos.js failed.
  pause
  exit /b 1
)
echo.

echo [4/5] 사진 스캔 + Git...
node scripts\scan-photos.js
if errorlevel 1 (
  echo.
  echo [ERROR] scan-photos.js failed.
  pause
  exit /b 1
)

echo.
git status --short

echo.
git add .
git commit -m "deploy: watermark + compress + data update"
if errorlevel 1 (
  echo [INFO] Nothing to commit, skipping...
)
git push origin main
if errorlevel 1 (
  echo [WARNING] Git push failed. Check network or auth.
  echo Continuing Cloudflare deploy...
)

echo.
echo [5/5] Cloudflare Pages deploy...
set CLOUDFLARE_API_TOKEN=
for /f "tokens=2 delims==" %%A in ('findstr "CLOUDFLARE_API_TOKEN" .env 2^>nul') do set CLOUDFLARE_API_TOKEN=%%A
if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo [WARNING] .env에서 토큰을 읽지 못했습니다. 환경 변수 또는 wrangler login을 사용하세요.
)
npx wrangler pages deploy public --project-name=sj-360-apt-vr --branch=main --commit-dirty=true
if errorlevel 1 (
  echo.
  echo [ERROR] Cloudflare deploy failed.
  echo Run: npx wrangler whoami
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Deploy complete!
echo  https://sj-360-apt-vr.pages.dev/
echo ============================================
pause
