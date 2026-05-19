// watermark-photos.js
// 원본(photos-original/) → 워터마크 합성 → photos/
// 워터마크 4방향 배치: 정면(50%) / 좌(25%) / 우(75%) / 뒤(~0%)
// SVG 합성, Malgun Gothic 폰트, quality 78 + mozjpeg + progressive
// Windows 한글 경로 대응: Buffer 방식

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const SOURCE_DIR  = path.join(__dirname, '..', 'public', 'photos-original');
const TARGET_DIR  = path.join(__dirname, '..', 'public', 'photos');
const SKIP_DIRS   = new Set(['optimized']);

/**
 * 이미지 전체 크기 SVG 오버레이 생성 (4방향 워터마크 박스 포함)
 */
function buildWatermarkSvg(imgW, imgH) {
  // 박스 크기: 이미지 폭의 13%
  const boxW = Math.round(imgW * 0.13);
  const boxH = Math.round(boxW * 0.26);
  const rx   = Math.round(boxW * 0.045);

  // 수직 위치: 이미지 높이의 55% (살짝 아래)
  const by = Math.round(imgH * 0.55) - Math.round(boxH / 2);

  // 폰트 크기
  const fs1 = Math.round(boxW * 0.115); // 제목
  const fs2 = Math.round(boxW * 0.092); // 연락처

  // 4개 수평 중심점 (equirectangular 기준)
  // 정면=50%, 좌=25%, 우=75%, 뒤=약 2% (seam 근처)
  const centers = [
    Math.round(imgW * 0.50),                // 정면
    Math.round(imgW * 0.25),                // 좌
    Math.round(imgW * 0.75),                // 우
    Math.round(boxW / 2) + 12,             // 뒤 (left seam 근처, box 잘리지 않게 clamped)
  ];

  const rects = centers.map(cx => {
    // 박스 좌측 x (이미지 경계 내로 clamped)
    const bx = Math.max(0, Math.min(Math.round(cx - boxW / 2), imgW - boxW));
    const tx = bx + Math.round(boxW / 2); // 텍스트 중심

    return `
  <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}"
    rx="${rx}" ry="${rx}"
    fill="rgba(255,255,255,0.92)"
    stroke="#8B6F47" stroke-width="2.5"/>
  <text
    x="${tx}" y="${by + Math.round(boxH * 0.37)}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="'Malgun Gothic','Noto Sans CJK KR','Apple SD Gothic Neo',sans-serif"
    font-size="${fs1}" font-weight="500" fill="#8B6F47"
  >하이엔드 아파트 전문 SJ부동산</text>
  <text
    x="${tx}" y="${by + Math.round(boxH * 0.73)}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="'Malgun Gothic','Noto Sans CJK KR','Apple SD Gothic Neo',sans-serif"
    font-size="${fs2}" fill="#6B6B6B"
  >전수진 · 010-2879-5452</text>`;
  }).join('');

  const svg = `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${rects}
</svg>`;

  return Buffer.from(svg);
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
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('\n❌ photos-original/ 폴더가 없습니다.');
    console.error('   배포.bat의 [1/5] 백업 단계를 먼저 실행하거나');
    console.error('   robocopy public\\photos public\\photos-original /E /XD optimized\n');
    process.exit(1);
  }

  const allFiles = walk(SOURCE_DIR);
  if (allFiles.length === 0) {
    console.log('\nNo JPG files found in photos-original/\n');
    return;
  }

  console.log(`\n🎨 워터마크 합성 시작: ${allFiles.length}장\n`);

  let done = 0;
  let errors = 0;
  const t0 = Date.now();

  for (const srcPath of allFiles) {
    try {
      const rel     = path.relative(SOURCE_DIR, srcPath);
      const dstPath = path.join(TARGET_DIR, rel);

      fs.mkdirSync(path.dirname(dstPath), { recursive: true });

      const inputBuffer = fs.readFileSync(srcPath);
      const meta        = await sharp(inputBuffer, { failOn: 'none' }).metadata();
      const { width: w, height: h } = meta;

      if (!w || !h) {
        console.warn(`  ⚠️ ${rel}: 메타데이터 읽기 실패, 건너뜀`);
        errors++;
        continue;
      }

      const svgOverlay = buildWatermarkSvg(w, h);

      const outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
        .composite([{ input: svgOverlay, blend: 'over' }])
        .jpeg({ quality: 78, mozjpeg: true, progressive: true })
        .toBuffer();

      fs.writeFileSync(dstPath, outputBuffer);

      const before = (inputBuffer.length   / 1024 / 1024).toFixed(1);
      const after  = (outputBuffer.length  / 1024 / 1024).toFixed(1);
      console.log(`  ✅ ${rel}  ${before}MB → ${after}MB`);
      done++;

    } catch (err) {
      const rel = path.relative(SOURCE_DIR, srcPath);
      console.error(`  ❌ ${rel}: ${err.message}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n📊 완료: ${done}장 합성, ${errors}장 오류 (${elapsed}s)\n`);

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
