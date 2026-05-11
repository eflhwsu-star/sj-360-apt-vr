// scan-photos.js
// public/photos/ 폴더를 스캔하여 busan.json의 buildings_data를 자동 갱신합니다.
// hosting: "self" 단지만 처리. 베뉴브(panoee) 단지는 건드리지 않습니다.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const photosDir = path.join(ROOT, 'public', 'photos');
const busanJsonPath = path.join(ROOT, 'public', 'data', 'busan.json');

const busan = JSON.parse(fs.readFileSync(busanJsonPath, 'utf8'));

let totalScanned = 0;
let totalApartmentsUpdated = 0;

Object.values(busan.apartments).forEach(apartment => {
  if (apartment.hosting !== 'self') return;
  if (!apartment.photos_folder) return;

  const apartmentDir = path.join(photosDir, apartment.photos_folder);
  if (!fs.existsSync(apartmentDir)) {
    console.log(`⚠️  ${apartment.photos_folder} 폴더 없음 (건너뜀)`);
    return;
  }

  // 동 폴더 목록 (숫자 디렉토리만)
  const buildingFolders = fs.readdirSync(apartmentDir).filter(f => {
    const fullPath = path.join(apartmentDir, f);
    return fs.statSync(fullPath).isDirectory();
  });

  let apartmentUpdated = false;

  buildingFolders.forEach(buildingId => {
    const buildingDir = path.join(apartmentDir, buildingId);
    const files = fs.readdirSync(buildingDir).filter(f =>
      /\.(jpg|jpeg|png)$/i.test(f)
    );

    if (files.length === 0) return;

    // 파일명 파싱: 마지막 숫자 그룹 = 높이
    // "101 30.jpg" → height: "30m", file: "101 30.jpg"
    // "101_30.jpg" → height: "30m"
    const scenes = [];
    files.forEach(file => {
      const baseName = file.replace(/\.(jpg|jpeg|png)$/i, '');
      const match = baseName.match(/(\d+)\s*$/);
      if (match) {
        scenes.push({
          height: `${match[1]}m`,
          file: file
        });
      } else {
        console.log(`  ⚠️  파일명 파싱 실패 (건너뜀): ${file}`);
      }
    });

    if (scenes.length === 0) return;

    // 높이 숫자 기준 오름차순 정렬
    scenes.sort((a, b) => parseInt(a.height) - parseInt(b.height));

    // buildings_data에서 해당 동 찾기 또는 신규 추가
    let building = apartment.buildings_data.find(b => b.id === buildingId);
    if (building) {
      building.captured = true;
      building.scenes = scenes;
    } else {
      apartment.buildings_data.push({
        id: buildingId,
        name: `${buildingId}동`,
        captured: true,
        scenes: scenes
      });
    }

    totalScanned += scenes.length;
    apartmentUpdated = true;
    console.log(`  ✅ ${apartment.short_name || apartment.name} ${buildingId}동: ${scenes.length}장`);
  });

  // 폴더가 없어진 동은 captured: false로 리셋
  apartment.buildings_data.forEach(b => {
    if (!buildingFolders.includes(b.id) && b.captured) {
      b.captured = false;
      b.scenes = [];
      console.log(`  🔄 ${apartment.short_name || apartment.name} ${b.id}동: 폴더 없음 → captured: false`);
    }
  });

  if (apartmentUpdated) totalApartmentsUpdated++;
});

// busan.json 저장
fs.writeFileSync(busanJsonPath, JSON.stringify(busan, null, 2), 'utf8');
console.log(`\n📊 스캔 완료: ${totalApartmentsUpdated}개 단지 갱신, 총 ${totalScanned}장`);
console.log(`💾 저장됨: ${busanJsonPath}`);
