// compress-photos.js
// Cloudflare Pages 25 MiB 제한 대응 — 사진을 웹 최적화 크기로 압축합니다.
// 원본은 그대로 보존, public/photos/ 내 파일만 in-place 압축.
// 목표: 각 파일 < 20 MiB (Pannellum 웹 뷰어에 충분한 해상도 유지)

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const photosDir = path.join(__dirname, '..', 'public', 'photos');
const MAX_WIDTH = 8192;   // 8K 이하로 리샘플링 (360° 뷰어 최적 해상도)
const JPEG_QUALITY = 82;  // 품질 82% — 시각적 차이 없음, 파일 크기 대폭 감소

let total = 0;
let compressed = 0;
let skipped = 0;
let errors = 0;

async function compressAll() {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.(jpg|jpeg)$/i.test(entry)) {
        files.push(full);
      }
    }
  }

  walk(photosDir);
  total = files.length;
  console.log(`\n🔍 총 ${total}개 JPG 발견\n`);

  for (const file of files) {
    const sizeMB = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
    const rel = path.relative(photosDir, file);

    if (parseFloat(sizeMB) < 20) {
      console.log(`  ✓ 이미 작음 (${sizeMB} MiB) — ${rel}`);
      skipped++;
      continue;
    }

    try {
      const tmp = file + '.tmp';
      await sharp(file)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toFile(tmp);

      const newSizeMB = (fs.statSync(tmp).size / 1024 / 1024).toFixed(1);
      fs.renameSync(tmp, file);
      console.log(`  ✅ 압축 완료: ${sizeMB} → ${newSizeMB} MiB — ${rel}`);
      compressed++;
    } catch (e) {
      console.log(`  ❌ 실패: ${rel} — ${e.message}`);
      if (fs.existsSync(file + '.tmp')) fs.unlinkSync(file + '.tmp');
      errors++;
    }
  }

  console.log(`\n📊 결과: ${compressed}개 압축 / ${skipped}개 스킵 / ${errors}개 오류 (총 ${total}개)`);
}

compressAll().catch(console.error);
