// scan-photos.js v3
// public/photos/ 폴더를 스캔하여 busan.json의 buildings_data / facilities_data를 자동 갱신합니다.
// hosting: "self" 단지만 처리.
//
// 파일명 파싱 규칙 (공백 split 기반):
//   "101 30.JPG"        → parts=["101","30"]     → line:null, height:"30m"  (베뉴브/남천/센텀 기존 형식)
//   "101 1 15.JPG"      → parts=["101","1","15"]  → line:"1",   height:"15m" (한화포레나 신규 형식)
//   "102 2,3 15.JPG"    → parts=["102","2,3","15"]→ line:"2,3", height:"15m" (복합 호라인)
//
// 폴더 분류:
//   숫자만(예: "101") → buildings_data
//   그 외(예: "부대시설") → facilities_data   (optimized 제외)

const fs = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const photosDir   = path.join(ROOT, 'public', 'photos');
const busanJsonPath = path.join(ROOT, 'public', 'data', 'busan.json');

const busan = JSON.parse(fs.readFileSync(busanJsonPath, 'utf8'));

let totalScanned    = 0;
let totalFacScanned = 0;
let totalUpdated    = 0;

/* ── 파일명 파싱 ── */
function parseFilename(filename) {
  const base  = filename.replace(/\.(jpg|jpeg|png)$/i, '').trim();
  const parts = base.split(/\s+/);

  if (parts.length === 2) {
    // 기존 형식: "101 30"
    if (!/^\d+$/.test(parts[1])) return null;
    return { line: null, height: `${parts[1]}m`, file: filename };
  } else if (parts.length >= 3) {
    // 신규 형식: "101 1 15" / "102 2,3 15"
    const lineStr   = parts[1];                    // "1", "2,3", "4,5" 등
    const heightStr = parts[parts.length - 1];
    if (!/^\d+$/.test(heightStr)) return null;
    return { line: lineStr, height: `${heightStr}m`, file: filename };
  }
  return null;
}

function parseFacilityFilename(filename) {
  const name = filename.replace(/\.(jpg|jpeg|png)$/i, '').trim();
  return { name, file: filename };
}

/* ── scenes 정렬: line 자연순 → height 숫자 오름차순 ── */
function sortScenes(scenes) {
  scenes.sort((a, b) => {
    if (a.line && b.line && a.line !== b.line) {
      return a.line.localeCompare(b.line, undefined, { numeric: true });
    }
    return parseInt(a.height) - parseInt(b.height);
  });
}

/* ── 메인 처리 ── */
Object.values(busan.apartments).forEach(apartment => {
  if (apartment.hosting !== 'self') return;
  if (!apartment.photos_folder) return;

  const aptDir = path.join(photosDir, apartment.photos_folder);
  if (!fs.existsSync(aptDir)) {
    console.log(`⚠️  ${apartment.photos_folder} 폴더 없음 (건너뜀)`);
    return;
  }

  // 폴더 목록 분류 (optimized 제외)
  const allDirs = fs.readdirSync(aptDir).filter(f =>
    f !== 'optimized' && fs.statSync(path.join(aptDir, f)).isDirectory()
  );
  const buildingFolders = allDirs.filter(f => /^\d+$/.test(f));
  const facilityFolders = allDirs.filter(f => !/^\d+$/.test(f));

  let updated = false;

  // ── 동 폴더 처리 ──────────────────────────────────────
  buildingFolders.forEach(buildingId => {
    const dir   = path.join(aptDir, buildingId);
    const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    if (files.length === 0) return;

    const scenes = [];
    files.forEach(file => {
      const parsed = parseFilename(file);
      if (parsed) {
        scenes.push(parsed);
      } else {
        console.log(`  ⚠️  파일명 파싱 실패 (건너뜀): ${file}`);
      }
    });
    if (scenes.length === 0) return;

    sortScenes(scenes);

    let building = apartment.buildings_data.find(b => b.id === buildingId);
    if (building) {
      building.captured = true;
      building.scenes   = scenes;
    } else {
      apartment.buildings_data.push({
        id: buildingId, name: `${buildingId}동`, captured: true, scenes
      });
    }

    totalScanned += scenes.length;
    updated = true;

    const lineKeys = [...new Set(scenes.filter(s => s.line).map(s => s.line))];
    const lineInfo = lineKeys.length ? ` (${lineKeys.join('·')}호라인)` : '';
    console.log(`  ✅ ${apartment.short_name || apartment.name} ${buildingId}동: ${scenes.length}장${lineInfo}`);
  });

  // 폴더가 없어진 동 → captured: false 리셋
  apartment.buildings_data.forEach(b => {
    if (!buildingFolders.includes(b.id) && b.captured) {
      b.captured = false;
      b.scenes   = [];
      console.log(`  🔄 ${apartment.short_name || apartment.name} ${b.id}동: 폴더 없음 → captured: false`);
    }
  });

  // ── 부대시설 폴더 처리 ────────────────────────────────
  if (facilityFolders.length > 0) {
    if (!apartment.facilities_data) apartment.facilities_data = [];

    facilityFolders.forEach(folderName => {
      const dir   = path.join(aptDir, folderName);
      const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (files.length === 0) return;

      const scenes = files
        .map(f => parseFacilityFilename(f))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

      let fac = apartment.facilities_data.find(f => f.id === folderName);
      if (fac) {
        fac.captured = true;
        fac.scenes   = scenes;
      } else {
        apartment.facilities_data.push({
          id: folderName, name: folderName, captured: true, scenes
        });
      }

      totalFacScanned += scenes.length;
      updated = true;
      console.log(`  🏗️  ${apartment.short_name || apartment.name} [${folderName}]: ${scenes.length}장`);
    });

    // 폴더가 없어진 부대시설 → captured: false 리셋
    apartment.facilities_data.forEach(f => {
      if (!facilityFolders.includes(f.id) && f.captured) {
        f.captured = false;
        f.scenes   = [];
      }
    });
  }

  if (updated) totalUpdated++;
});

fs.writeFileSync(busanJsonPath, JSON.stringify(busan, null, 2), 'utf8');
console.log(`\n📊 스캔 완료: ${totalUpdated}개 단지 갱신`);
console.log(`   동별 조망: ${totalScanned}장 / 부대시설: ${totalFacScanned}장`);
console.log(`💾 저장됨: ${busanJsonPath}`);
