// scan-photos.js v5
// public/photos/ 폴더를 스캔하여 busan.json의 buildings_data / facilities_data를 자동 갱신합니다.
// hosting: "self" 단지만 처리.
//
// 파일명 파싱 규칙 (고도=마지막 토큰에서 "m" 제거 후 숫자 / 호라인="...라인" 또는 가운데 숫자):
//   "101 30.JPG"            → line:null,  height:"30m"   (베뉴브/남천/센텀 기존)
//   "101 1 15.JPG"          → line:"1",   height:"15m"   (한화포레나 기존)
//   "102 2,3 15.JPG"        → line:"2,3", height:"15m"   (복합 호라인 기존)
//   "1,2라인 110m.JPG"      → line:"1,2", height:"110m"  (GS하이츠·더블유 신규)
//   "101동 110m.JPG"        → line:null,  height:"110m"  (삼익비치 신규)
//   "101동 102동 중앙 100m.JPG" → line:null, height:"100m" (협진태양 평면배치 신규)
//
// 폴더 분류 (v5):
//   동 폴더  : 폴더명에서 "동" 제거 후 숫자("301동"→301) 또는 알파벳("A","B") → buildings_data
//   평면배치 : 동 폴더 없이 루트에 VR 이미지가 있으면 파일명 프리픽스별로 동 구성 (협진태양)
//   시설 폴더: 그 외("부대시설","주변 환경") → 이미지가 1장이라도 있으면 facilities_data
//   (optimized 폴더는 항상 제외)
//
// ── "VR/이미지 없는 폴더 자동 무시" 규칙 ───────────────────────────────
//   · 동 폴더: 유효 VR .jpg가 1개도 없으면 무시 (영상 제작용 "인트로" 등 차단)
//   · 시설 폴더: 이미지가 0장이고 기존 등록 시설도 아니면 무시 ("인트로"=mp4만 → 무시,
//     "주변 환경"=서술형 이미지 보유 → 시설 유지, 기존 "부대시설" 유지)
//   무시된 폴더는 ignoredFolders에 모아 마지막에 출력.
//
// 실행 옵션:
//   node scan-photos.js              → 스캔 후 busan.json 저장
//   node scan-photos.js --preview    → 저장하지 않고 변경 미리보기만 출력 (--dry-run 동일)

const fs = require('fs');
const path = require('path');

const PREVIEW = process.argv.includes('--preview') || process.argv.includes('--dry-run');

const ROOT        = path.join(__dirname, '..');
const photosDir   = path.join(ROOT, 'public', 'photos');
const busanJsonPath = path.join(ROOT, 'public', 'data', 'busan.json');

const busan = JSON.parse(fs.readFileSync(busanJsonPath, 'utf8'));

// 미리보기 비교용: 변경 전 동/시설 개수 스냅샷
const beforeSnapshot = {};
Object.entries(busan.apartments).forEach(([key, a]) => {
  beforeSnapshot[key] = {
    buildings:  (a.buildings_data  || []).filter(b => b.captured).length,
    facilities: (a.facilities_data || []).filter(f => f.captured).length,
  };
});

let totalScanned    = 0;
let totalFacScanned = 0;
let totalUpdated    = 0;
const ignoredFolders = [];   // { apt, folder, reason }

/* ── 파일명 파싱 (v5) ──
   고도 = 마지막 토큰에서 "m" 제거 후 숫자.  호라인 = "...라인" 토큰 또는
   기존 형식의 가운데 순수 숫자/콤마 토큰.  앞쪽 동 라벨("101동","중앙" 등)은 무시.
   파싱에 성공하면 {line, height, file}, 아니면 null. */
function parseFilename(filename) {
  const base   = filename.replace(/\.(jpg|jpeg|png)$/i, '').trim();
  const tokens = base.split(/\s+/);
  if (tokens.length < 2) return null;

  // 고도: 마지막 토큰, "110m" 또는 "110" 형태만 허용
  const hm = tokens[tokens.length - 1].match(/^(\d+)\s*m?$/i);
  if (!hm) return null;
  const height = hm[1];
  const rest   = tokens.slice(0, -1);   // 고도 제외 앞부분

  // 호라인: ① "1,2라인" 형태 우선  ② 없으면 기존 "101 1 15"의 가운데 숫자 토큰
  let line = null;
  const lineTok = rest.find(t => /^[\d,]+라인$/.test(t));
  if (lineTok) {
    line = lineTok.replace(/라인$/, '');
  } else if (rest.length >= 2 && /^[\d,]+$/.test(rest[rest.length - 1])) {
    line = rest[rest.length - 1];       // "101 1 15"→"1" / "102 2,3 15"→"2,3"
  }
  return { line, height: `${height}m`, file: filename };
}

/* 유효 VR 파일명 = 위 파서가 {line,height}를 추출해내는 파일 */
function isVrFilename(filename) {
  return parseFilename(filename) !== null;
}

/* 폴더에 이미지(.jpg/.jpeg/.png)가 1장이라도 있는가? (시설 분류용) */
function hasAnyImage(dir) {
  return fs.readdirSync(dir).some(f => /\.(jpg|jpeg|png)$/i.test(f));
}

/* ── 동 식별: 폴더명 → 동 id (동 폴더가 아니면 null) ──
   "301동"→"301", "101"→"101", "A"→"A".  "주변 환경"·"부대시설"·"인트로"→null */
function buildingIdOf(folderName) {
  const s = folderName.replace(/동$/, '').trim();
  if (/^\d+$/.test(s))           return s;   // 숫자 동 (101, 301)
  if (/^[A-Za-z]{1,3}$/.test(s)) return s;   // 알파벳 동 (A/B/C/D)
  return null;
}
function buildingNameOf(folder) {
  return /동$/.test(folder) ? folder : `${folder}동`;   // "301동"→"301동", "101"→"101동", "A"→"A동"
}

/* ── 평면(루트) 배치용: 파일명에서 동 프리픽스 추출 ──
   "101동 102동 중앙 100m" → "101동 102동 중앙" (고도/호라인 토큰 제외) */
function dongPrefixOf(filename) {
  const base   = filename.replace(/\.(jpg|jpeg|png)$/i, '').trim();
  const tokens = base.split(/\s+/).slice(0, -1);   // 고도 제외
  return tokens
    .filter(t => !/^[\d,]+라인$/.test(t) && !/^[\d,]+$/.test(t))
    .join(' ')
    .trim();
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

  // 폴더 목록 (optimized 제외)
  const allDirs = fs.readdirSync(aptDir).filter(f =>
    f !== 'optimized' && fs.statSync(path.join(aptDir, f)).isDirectory()
  );

  // ── 동/시설 폴더 분류 (v5: "301동"·"A" 등 동 식별) ──
  const buildingUnits   = [];   // { id, name, dir, files }
  const facilityFolders = [];
  allDirs.forEach(folder => {
    const isDong = buildingIdOf(folder) !== null;   // "301동"·"A"·"101" 동 판별 (시설이면 null)
    if (isDong) {
      const dir = path.join(aptDir, folder);
      const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      // ★ id = 실제 폴더명. 프론트가 photos/{단지}/{building.id}/{scene.file} 로 요청하므로
      //   id가 디스크 폴더명과 정확히 같아야 404가 안 난다 ("301동"→폴더 "301동").
      buildingUnits.push({ id: folder, name: buildingNameOf(folder), dir, files });
    } else {
      facilityFolders.push(folder);
    }
  });

  // ── 평면(루트) 배치: 동 폴더 없이 루트에 VR 이미지가 있으면 프리픽스별로 동 구성 (협진태양) ──
  const rootVrImgs = fs.readdirSync(aptDir).filter(f =>
    /\.(jpg|jpeg|png)$/i.test(f) && isVrFilename(f)
  );
  if (rootVrImgs.length > 0) {
    const groups = {};
    rootVrImgs.forEach(f => {
      const key = dongPrefixOf(f) || (apartment.short_name || apartment.name);
      (groups[key] = groups[key] || []).push(f);
    });
    Object.entries(groups).forEach(([key, files]) => {
      // ★ 평면배치: 파일이 단지 폴더 루트에 있음(하위 동 폴더 없음) → 경로 세그먼트는 현재 디렉터리 "."
      //   프론트 요청 photos/{단지}/./{file} 은 URL 정규화로 photos/{단지}/{file} 에 해석되어 정상 로드됨.
      //   (DOM에서는 getElementById('building-.')로만 참조되어 "." 사용이 안전)
      buildingUnits.push({ id: '.', name: key, dir: aptDir, files });
    });
  }

  let updated = false;

  // ── 동 처리 ──────────────────────────────────────────
  buildingUnits.forEach(unit => {
    // 유효한 VR .jpg가 1개도 없으면 동으로 등록하지 않고 무시
    if (!unit.files.some(isVrFilename)) {
      ignoredFolders.push({ apt: apartment.short_name || apartment.name, folder: unit.id, reason: '유효 VR .jpg 없음' });
      console.log(`  🚫 무시된 폴더: ${unit.id} (유효 VR .jpg 없음)`);
      return;
    }

    const scenes = [];
    unit.files.forEach(file => {
      const parsed = parseFilename(file);
      if (parsed) {
        scenes.push(parsed);
      } else {
        console.log(`  ⚠️  파일명 파싱 실패 (건너뜀): ${file}`);
      }
    });
    if (scenes.length === 0) return;

    sortScenes(scenes);

    let building = apartment.buildings_data.find(b => b.id === unit.id);
    if (building) {
      building.captured = true;
      building.scenes   = scenes;
      if (!building.name) building.name = unit.name;
    } else {
      apartment.buildings_data.push({
        id: unit.id, name: unit.name, captured: true, scenes
      });
    }

    totalScanned += scenes.length;
    updated = true;

    const lineKeys = [...new Set(scenes.filter(s => s.line).map(s => s.line))];
    const lineInfo = lineKeys.length ? ` (${lineKeys.join('·')}호라인)` : '';
    console.log(`  ✅ ${apartment.short_name || apartment.name} ${unit.name}: ${scenes.length}장${lineInfo}`);
  });

  // 폴더가 없어진 동 → captured: false 리셋
  const presentBuildingIds = new Set(buildingUnits.map(u => u.id));
  apartment.buildings_data.forEach(b => {
    if (!presentBuildingIds.has(b.id) && b.captured) {
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

      // [v5] 시설 폴더 무시 규칙:
      //   시설 파일명은 서술형("잔디마당")이라 VR 형식이 아님 → 이미지가 1장이라도
      //   있거나(서술형 포함) 이미 등록된 시설이면 등록.  이미지 0장(영상 제작용
      //   "인트로"=mp4만)이고 미등록이면 무시.  "주변 환경"=서술형 이미지 보유 → 유지.
      const isKnownFacility = apartment.facilities_data.some(f => f.id === folderName);
      if (!hasAnyImage(dir) && !isKnownFacility) {
        ignoredFolders.push({ apt: apartment.short_name || apartment.name, folder: folderName, reason: '동 아님 (이미지 0장·미등록 시설)' });
        console.log(`  🚫 무시된 폴더: ${folderName} (동 아님 / 이미지 0장 · 미등록 시설)`);
        return;
      }

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

console.log(`\n📊 스캔 완료: ${totalUpdated}개 단지 갱신`);
console.log(`   동별 조망: ${totalScanned}장 / 부대시설: ${totalFacScanned}장`);

// ── 무시된 폴더 요약 ──
if (ignoredFolders.length) {
  console.log(`\n🚫 무시된 폴더 (${ignoredFolders.length}개):`);
  ignoredFolders.forEach(x => console.log(`   - ${x.apt} / ${x.folder}  · ${x.reason}`));
} else {
  console.log(`\n🚫 무시된 폴더: 없음`);
}

if (PREVIEW) {
  // ── 미리보기: 저장하지 않고 변경 사항만 출력 ──
  console.log(`\n👁  미리보기 모드 (--preview): busan.json 저장 안 함\n`);
  console.log(`📋 단지별 동/시설 개수 (변경 전 → 변경 후):`);
  Object.entries(busan.apartments).forEach(([key, a]) => {
    if (a.hosting !== 'self') return;
    const before = beforeSnapshot[key] || { buildings: 0, facilities: 0 };
    const afterB  = (a.buildings_data  || []).filter(b => b.captured).length;
    const afterF  = (a.facilities_data || []).filter(f => f.captured).length;
    const diff = (before.buildings !== afterB || before.facilities !== afterF) ? '  ⟵ 변경' : '';
    console.log(`   • ${a.short_name || a.name}: 동 ${before.buildings}→${afterB} / 시설 ${before.facilities}→${afterF}${diff}`);
  });
  console.log(`\n💡 실제 저장하려면: node scripts/scan-photos.js (옵션 없이) 실행`);
} else {
  fs.writeFileSync(busanJsonPath, JSON.stringify(busan, null, 2), 'utf8');
  console.log(`\n💾 저장됨: ${busanJsonPath}`);
}
