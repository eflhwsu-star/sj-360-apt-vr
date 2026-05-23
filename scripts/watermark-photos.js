// watermark-photos.js v3 — 2방향 (정면 yaw:0 + 후면 yaw:180)
// 원본(photos-original/) → 워터마크 합성 → photos/
// 180도 간격으로 어느 방향을 보든 최대 90도 안에 워터마크 시야 진입

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const photosDir   = path.join(__dirname, '..', 'public', 'photos');
const originalDir = path.join(__dirname, '..', 'public', 'photos-original');

function createWatermarkSvg(scale = 1.0) {
  const w = Math.round(720 * scale);
  const h = Math.round(120 * scale);
  return `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${w}" height="${h}"
            fill="rgba(255,255,255,0.92)" rx="${Math.round(12*scale)}"
            stroke="rgba(139,111,71,0.2)" stroke-width="1"/>
      <text x="${w/2}" y="${h*0.45}"
            font-family="'Malgun Gothic', 'Noto Sans CJK KR', sans-serif"
            font-size="${Math.round(28*scale)}" font-weight="500"
            fill="#8B6F47" text-anchor="middle">
        하이엔드 아파트 전문 SJ부동산
      </text>
      <text x="${w/2}" y="${h*0.78}"
            font-family="'Malgun Gothic', 'Noto Sans CJK KR', sans-serif"
            font-size="${Math.round(22*scale)}"
            fill="#6B6B6B" text-anchor="middle">
        전수진 · 010-2879-5452
      </text>
    </svg>
  `;
}

async function addWatermark(originalPath, outputPath) {
  const inputBuffer = fs.readFileSync(originalPath);
  const image = sharp(inputBuffer, { failOn: 'none' });
  const meta  = await image.metadata();
  const { width, height } = meta;

  const wmScale  = Math.max(0.8, (width / 8000) * 1.2);
  const svgStr   = createWatermarkSvg(wmScale);
  const wmWidth  = Math.round(720 * wmScale);
  const wmHeight = Math.round(120 * wmScale);
  const yPos     = Math.round(height * 0.55 - wmHeight / 2);

  // 2방향: 정면(width 50%) + 후면(width 0% = 좌끝, sphere wrap으로 정확히 yaw 180)
  const positions = [
    { left: Math.round(width * 0.5 - wmWidth / 2), top: yPos },  // 정면 (yaw  0°)
    { left: 0,                                       top: yPos },  // 후면 (yaw 180°)
  ];

  const composites = positions.map(pos => ({
    input: Buffer.from(svgStr),
    left:  Math.max(0, Math.min(pos.left, width - wmWidth)),
    top:   Math.max(0, Math.min(pos.top,  height - wmHeight)),
    blend: 'over'
  }));

  const buffer = await image
    .composite(composites)
    .jpeg({ quality: 78, mozjpeg: true, progressive: true })
    .toBuffer();

  fs.writeFileSync(outputPath, buffer);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(item => {
    if (item === 'optimized') return [];
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (/\.(jpg|jpeg)$/i.test(item)) return [full];
    return [];
  });
}

async function main() {
  if (!fs.existsSync(originalDir)) {
    console.error('❌ photos-original/ 폴더 없음. 백업 단계 먼저 실행 필요.');
    process.exit(1);
  }

  const allOriginals = walk(originalDir);
  console.log(`\n📸 총 ${allOriginals.length}장 워터마크 처리 시작 (정면+후면 2방향)\n`);

  let processed = 0, failed = 0;
  const t0 = Date.now();

  for (const originalPath of allOriginals) {
    try {
      const relativePath = path.relative(originalDir, originalPath);
      const outputPath   = path.join(photosDir, relativePath);
      const outputDir    = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      await addWatermark(originalPath, outputPath);
      processed++;

      if (processed % 20 === 0 || processed === allOriginals.length) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  ✅ ${processed}/${allOriginals.length} 진행 중... (${elapsed}s)`);
      }
    } catch (err) {
      console.error(`  ❌ ${path.basename(originalPath)}: ${err.message}`);
      failed++;
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n📊 완료: ${processed}장 성공, ${failed}장 실패 (${total}s)\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
