// compress-photos.js v4
// Cloudflare Pages 25 MiB 제한 대응 + Pannellum 로딩 최적화
// 목표: 모든 사진 2 MiB 이하 (워터마크 합성 후 추가 압축)
// ⚠️ Windows 한글 경로 대응: 파일 경로 대신 Buffer 방식 사용

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const photosDir = path.join(__dirname, '..', 'public', 'photos');
const TARGET_MAX_SIZE = 2 * 1024 * 1024; // 2 MiB (v4: 2.5→2)
const MAX_WIDTH = 6144;                   // 6K (v4: 8192→6144)
const SKIP_DIRS = new Set(['optimized']);

async function compressIfNeeded(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size <= TARGET_MAX_SIZE) {
    return { compressed: false, sizeBefore: stat.size, sizeAfter: stat.size };
  }
  const sizeBefore = stat.size;
  // Buffer 방식: Windows 한글 경로 sharp 오픈 오류 우회
  const inputBuffer = fs.readFileSync(filePath);
  const outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true, progressive: true })  // v4: 75→70
    .toBuffer();
  fs.writeFileSync(filePath, outputBuffer);
  const sizeAfter = fs.statSync(filePath).size;
  return { compressed: true, sizeBefore, sizeAfter };
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(item => {
    if (SKIP_DIRS.has(item)) return [];
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (/\.(jpg|jpeg)$/i.test(item)) return [full];
    return [];
  });
}

async function main() {
  let totalCompressed = 0;
  let totalSaved = 0;
  const allFiles = walk(photosDir);

  if (allFiles.length === 0) {
    console.log('No JPG files found in public/photos/');
    return;
  }

  console.log(`\n🔍 총 ${allFiles.length}개 JPG 검사 중...\n`);

  for (const file of allFiles) {
    try {
      const result = await compressIfNeeded(file);
      if (result.compressed) {
        const before = (result.sizeBefore / 1024 / 1024).toFixed(1);
        const after = (result.sizeAfter / 1024 / 1024).toFixed(1);
        const rel = path.relative(photosDir, file);
        console.log(`  ✅ ${rel}: ${before}MB → ${after}MB`);
        totalCompressed++;
        totalSaved += result.sizeBefore - result.sizeAfter;
      }
    } catch (err) {
      const rel = path.relative(photosDir, file);
      console.error(`  ❌ ${rel}: ${err.message}`);
    }
  }

  if (totalCompressed === 0) {
    console.log('  ✓ All files already within 2 MiB target.');
  } else {
    const savedMB = (totalSaved / 1024 / 1024).toFixed(1);
    console.log(`\n📊 압축 완료: ${totalCompressed}장, ${savedMB}MB 절감`);
  }
}

main().catch(err => {
  console.error('Compression failed:', err);
  process.exit(1);
});
