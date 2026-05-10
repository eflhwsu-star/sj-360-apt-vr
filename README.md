# SJ-360 APT VR

SJ부동산 부산광역시 분양 단지 360도 VR 조망 서비스. 드론 촬영 영상을 Panoee iframe으로 임베드하여 제공합니다.

## 페이지 구조

```
index.html              부산 메인 (구 그리드)
  → district.html?d=    구별 단지 리스트
    → apartment.html?id= 단지 상세 + 360 VR
```

## 로컬 미리보기

```bash
cd sj-360-apt-vr/public
python -m http.server 8000
```

http://localhost:8000 접속 (fetch() 사용으로 로컬 서버 필수)

## VR 시청 Funnel 로직

- **1~2번째 VR 시청**: 자유 (sessionStorage 카운트)
- **3번째 VR 시도**: 비번 모달 표시
- **비번 통과 후**: 세션 동안 무제한 (탭 닫으면 리셋)

## 단지 추가

1. `public/data/busan.json`의 `apartments` 객체에 신규 단지 추가 (기존 venuv 참조)
2. 해당 구의 `apartment_ids` 배열에 단지 ID 추가
3. 끝 — 별도 HTML 파일 불필요, 자동 렌더링

```json
// busan.json 예시
"apartments": {
  "signal": {
    "id": "signal",
    "district_id": "haeundae",
    ...
  }
},
"districts": [
  { "id": "haeundae", "apartment_ids": ["venuv", "signal"] }
]
```

## 구 추가

`busan.json`의 `districts` 배열에 새 구 객체 추가:

```json
{
  "id": "dongrae",
  "name": "동래구",
  "name_en": "Dongrae",
  "subtitle": "온천·교통 중심 주거 생활권",
  "apartment_ids": []
}
```

## 동별 촬영 추가

해당 단지의 `buildings_data`에서 `captured: false` → `true` 변경 후 `scenes` 배열 추가:

```json
{ "height": "30m", "url": "https://panoee.live/eflhwsu/post-xxx?sceneId=xxxx" }
```

> URL에 `&embed=true`는 붙이지 마세요. apartment.js가 자동으로 추가합니다.

## 비밀번호 / 횟수 변경

`public/js/apartment.js` 상단:

```js
const PASSWORD = '새비밀번호';
const FREE_VIEW_LIMIT = 2; // 무료 시청 횟수
```

## 파일 구조

```
sj-360-apt-vr/
  public/
    index.html          부산 메인 페이지
    district.html       구별 단지 리스트
    apartment.html      단지 상세 + VR 뷰어
    data/
      busan.json        전체 데이터 (구 + 단지)
    css/
      base.css          CSS 변수, 폰트, 공통
      main.css          메인 페이지 스타일
      district.css      구 페이지 스타일
      apartment.css     단지 페이지 스타일 (모달 포함)
    js/
      main.js           구 그리드 렌더링
      district.js       단지 리스트 렌더링
      apartment.js      VR 뷰어 + Funnel 로직
    img/
      logo.svg          SJ부동산 로고
```

## 배포

Cloudflare Pages 연동 후 `public/` 폴더를 루트로 지정하여 배포.
도메인: sj-360-apt-vr.pages.dev (예정)
