const sharp=require('sharp');const fs=require('fs');const path=require('path');
// 원본 vs 배포본을 작게 리사이즈 후 픽셀 차이로 워터마크(흰 박스) 위치 탐지
async function detect(orig,dep){
  const W=512,H=256;
  const o=await sharp(orig).resize(W,H,{fit:'fill'}).removeAlpha().raw().toBuffer();
  const d=await sharp(dep ).resize(W,H,{fit:'fill'}).removeAlpha().raw().toBuffer();
  // 배포본에서 "흰색이면서 원본은 흰색이 아니었던" 픽셀 = 워터마크 후보
  let wmPixels=0, minX=W,maxX=0,minY=H,maxY=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*3;
    const dw=d[i]>205&&d[i+1]>205&&d[i+2]>205;
    const ow=o[i]>205&&o[i+1]>205&&o[i+2]>205;
    const bigDiff=Math.abs(d[i]-o[i])+Math.abs(d[i+1]-o[i+1])+Math.abs(d[i+2]-o[i+2])>120;
    if(dw&&!ow&&bigDiff){wmPixels++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  const boxW=maxX-minX,boxH=maxY-minY;
  return {wmPixels,boxX:`${minX}-${maxX}`,boxY:`${minY}-${maxY}`,boxW,boxH,
    has: wmPixels>150 && boxW>20};
}
(async()=>{
  const apt=process.argv[2]||'한화포레나 부산대연';
  const sub='101';
  const oDir=path.join(__dirname,'..','public','photos-original',apt,sub);
  const dDir=path.join(__dirname,'..','public','photos',apt,sub);
  const files=fs.readdirSync(oDir).filter(f=>/\.jpe?g$/i.test(f)).sort().slice(0,6);
  console.log(`\n===== ${apt} =====`);
  let ok=0;
  for(const f of files){
    const o=path.join(oDir,f),d=path.join(dDir,f);
    if(!fs.existsSync(d)){console.log(`  ${f}: 배포본없음`);continue;}
    const r=await detect(o,d);
    console.log(`  ${f}: 워터마크픽셀 ${r.wmPixels}개 영역[x${r.boxX} y${r.boxY} ${r.boxW}x${r.boxH}] ${r.has?'✅워터마크있음':'❌없음'}`);
    if(r.has)ok++;
  }
  console.log(`  → ${ok}/${files.length} 워터마크 검출`);
})();
