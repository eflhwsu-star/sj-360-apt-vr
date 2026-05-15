@echo off
chcp 65001 >nul
echo ============================================
echo  SJ-360 APT VR Deploy
echo ============================================
echo.
cd /d "%~dp0"
echo Working directory: %CD%
echo.

echo [1/6] Compressing existing photos (Cloudflare 25 MiB limit)...
node scripts\compress-photos.js
if errorlevel 1 (
  echo.
  echo [ERROR] compress-photos.js failed.
  echo Please check: node_modules\sharp is installed (run: npm install)
  pause
  exit /b 1
)

echo.
echo [2/6] Compressing Hanwha Daeyeon photos to optimized/...
node scripts\compress-hanwha.js
if errorlevel 1 (
  echo.
  echo [ERROR] compress-hanwha.js failed.
  pause
  exit /b 1
)

echo.
echo [3/6] Scanning photos and updating busan.json...
node scripts\scan-photos.js
if errorlevel 1 (
  echo.
  echo [ERROR] scan-photos.js failed.
  echo Please check: node is installed (https://nodejs.org)
  pause
  exit /b 1
)

echo.
echo [4/6] Git status...
git status --short

echo.
echo [5/6] Git add + commit + push...
git add .
git commit -m "deploy: photos and data update"
if errorlevel 1 (
  echo [INFO] Nothing to commit, skipping...
)
git push origin main
if errorlevel 1 (
  echo [WARNING] Git push failed. Check network or auth.
  echo Continuing Cloudflare deploy...
)

echo.
echo [6/6] Cloudflare Pages deploy...
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
