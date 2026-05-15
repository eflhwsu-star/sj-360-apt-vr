// compress-hanwha.js
// 한화포레나 부산대연 사진 압축 + optimized/ 출력 (원본 보존)
// 출력: public/photos/한화포레나 부산대연/optimized/{서브폴더}/
// 설정: max-width 4096, JPEG q75 mozjpeg progressive
// 파일명 통일: 어린이놀이터 → 어린이 놀이터
// Windows 한글 경로 대응: Buffer 방식

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'photos', '한화포레나 부산대연');
const OUT = path.join(SRC, 'optimized');
const MAX_WIDTH = 4096;
const QUALITY = 75;

function normalizeName(name) {
  return name
    .replace(/어린이놀이터/g, '어린이 놀이터');
}

function walk(dir, relBase) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(item => {
    const full = path.join(dir, item);
    const rel  = relBase ? path.join(relBase, item) : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item === 'optimized') return [];   // 출력 디렉터리 제외
      return walk(full, rel);
    }
    if (/\.(jpg|jpeg)$/i.test(item)) {
      return [{ full, rel, subdir: relBase || '', name: item }];
    }
    return [];
  });
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.log('');
    console.log('[SKIP] Source folder not found:');
    console.log('  ' + SRC);
    console.log('');
    console.log('Place photos there first, then re-run this script.');
    return;
  }

  const files = walk(SRC, '');
  if (files.length === 0) {
    console.log('[SKIP] No JPG files found in source folder.');
    return;
  }

  console.log('');
  console.log('Compressing ' + files.length + ' photos -> optimized/');
  console.log('');

  let done = 0;
  let totalSaved = 0;

  for (const { full, subdir, name } of files) {
    try {
      const normalizedName = normalizeName(name);
      const outSubDir = path.join(OUT, subdir);
      const outPath   = path.join(outSubDir, normalizedName);

      fs.mkdirSync(outSubDir, { recursive: true });

      const inputBuffer = fs.readFileSync(full);
      const sizeBefore  = inputBuffer.length;

      const outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
        .toBuffer();

      fs.writeFileSync(outPath, outputBuffer);

      const sizeAfter = outputBuffer.length;
      const before    = (sizeBefore  / 1024 / 1024).toFixed(1);
      const after     = (sizeAfter   / 1024 / 1024).toFixed(1);
      const tag       = name !== normalizedName ? ' [renamed]' : '';
      console.log('  OK  ' + (subdir || '.') + '/' + name + '  ' + before + 'MB -> ' + after + 'MB' + tag);

      done++;
      totalSaved += sizeBefore - sizeAfter;
    } catch (err) {
      console.error('  ERR ' + subdir + '/' + name + ': ' + err.message);
    }
  }

  const savedMB = (totalSaved / 1024 / 1024).toFixed(1);
  console.log('');
  console.log('Done: ' + done + ' files, ' + savedMB + 'MB saved');
  console.log('Output: ' + OUT);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
