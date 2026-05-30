// diagnose-watermark.js — 픽셀 레벨 워터마크 검증
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const photosDir = path.join(__dirname, '..', 'public', 'photos');

// 워터마크 박스 안 "확실히 흰색"인 지점을 여러 곳 샘플링
// 정면(width*0.5) 박스: 가로 중앙±, 세로 0.55 근처
async function sampleRegion(filePath, cx, cy, label) {
  const meta = await sharp(filePath).metadata();
  const { width, height } = meta;
  const left = Math.max(0, Math.min(cx - 5, width - 10));
  const top  = Math.max(0, Math.min(cy - 5, height - 10));
  const region = await sharp(filePath)
    .extract({ left, top, width: 10, height: 10 })
    .raw()
    .toBuffer();
  let r = 0, g = 0, b = 0;
  const channels = region.length / 100; // 10x10 px
  for (let i = 0; i < region.length; i += channels) {
    r += region[i]; g += region[i + 1]; b += region[i + 2];
  }
  r = Math.round(r / 100); g = Math.round(g / 100); b = Math.round(b / 100);
  const white = r > 200 && g > 200 && b > 200;
  return { label, left, top, r, g, b, white };
}

async function diagnoseFile(filePath) {
  const meta = await sharp(filePath).metadata();
  const { width, height } = meta;
  // 정면 박스 안 여러 지점 + 후면(좌끝) 박스
  const wmScale  = Math.max(0.8, (width / 8000) * 1.2);
  const wmWidth  = Math.round(720 * wmScale);
  const wmHeight = Math.round(120 * wmScale);
  const yCenter  = Math.round(height * 0.55);

  const points = [
    // 정면 박스: 박스 좌측 1/4 지점(흰 배경 가능성 높음)
    { cx: Math.round(width * 0.5 - wmWidth * 0.35), cy: yCenter, label: '정면-좌측배경' },
    { cx: Math.round(width * 0.5),                  cy: yCenter, label: '정면-중앙' },
    { cx: Math.round(width * 0.5 + wmWidth * 0.35), cy: yCenter, label: '정면-우측배경' },
    // 후면 박스(좌끝 0): 박스 중앙
    { cx: Math.round(wmWidth * 0.25),               cy: yCenter, label: '후면-좌끝' },
  ];
  const results = [];
  for (const p of points) {
    results.push(await sampleRegion(filePath, p.cx, p.cy, p.label));
  }
  return { width, height, results };
}

function firstJpg(dir) {
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter(x => /\.jpe?g$/i.test(x)).sort();
  return f.length ? path.join(dir, f[0]) : null;
}

async function main() {
  const apts = [
    { name: '베뉴브 해운대',     sub: '101' },
    { name: '남천써밋',          sub: '101' },
    { name: '센텀르엘',          sub: '101' },
    { name: '한화포레나 부산대연', sub: '101' },
  ];

  for (const apt of apts) {
    const dir = path.join(photosDir, apt.name, apt.sub);
    const sample = firstJpg(dir);
    console.log(`\n===== ${apt.name} =====`);
    if (!sample) { console.log('  ⚠️ 샘플 없음'); continue; }
    console.log(`  파일: ${path.basename(sample)}`);
    const { width, height, results } = await diagnoseFile(sample);
    console.log(`  크기: ${width}x${height}`);
    let anyWhite = false;
    for (const r of results) {
      console.log(`   [${r.label}] RGB(${r.r},${r.g},${r.b}) ${r.white ? '⬜흰색' : '🏞️풍경'} @(${r.left},${r.top})`);
      if (r.white) anyWhite = true;
    }
    console.log(`  판정: ${anyWhite ? '✅ 워터마크 흔적 있음' : '❌ 워터마크 없음 (전부 풍경)'}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
