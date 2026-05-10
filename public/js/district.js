(function () {
  const params = new URLSearchParams(window.location.search);
  const districtId = params.get('d');

  if (!districtId) {
    location.href = 'index.html';
    return;
  }

  fetch('data/busan.json')
    .then(r => r.json())
    .then(data => {
      const district = data.districts.find(d => d.id === districtId);
      if (!district) {
        location.href = 'index.html';
        return;
      }
      document.title = `${district.name} 분양 360 VR | SJ부동산`;
      const apartmentList = district.apartment_ids.map(id => data.apartments[id]).filter(Boolean);
      renderHero(district, apartmentList.length);
      renderApartments(district, apartmentList);
    })
    .catch(e => console.error('데이터 로드 실패:', e));

  function renderHero(district, count) {
    document.getElementById('district-hero').innerHTML = `
      <div class="section-inner">
        <a href="index.html" class="back-link">← 부산 전체</a>
        <h1 class="district-name">${district.name}</h1>
        <p class="district-name-en">${district.name_en}</p>
        <p class="district-subtitle">${district.subtitle}</p>
      </div>
    `;
  }

  function renderApartments(district, apartmentList) {
    const section = document.getElementById('apartments-section');

    if (apartmentList.length === 0) {
      section.innerHTML = `
        <div class="section-inner">
          <div class="empty-state">
            <p class="empty-title">현재 등록된 분양 단지가 없습니다</p>
            <p class="empty-desc">신규 분양 정보를 가장 먼저 받아보시려면 카톡방에 입장해주세요</p>
            <div class="kakao-btn-wrap">
              <a href="https://open.kakao.com/o/g7PstLai" target="_blank" rel="noopener noreferrer" class="kakao-btn">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M7 1.5C3.962 1.5 1.5 3.47 1.5 5.9c0 1.516.9 2.85 2.27 3.67l-.62 2.3 2.84-1.62c.32.05.65.08.99.08 3.038 0 5.5-1.97 5.5-4.4S10.038 1.5 7 1.5z" fill="var(--kakao-text)"/>
                </svg>
                SJ부동산 카톡방 입장하기
              </a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const cardsHtml = apartmentList.map(apt => `
      <article class="apartment-card" onclick="location.href='apartment.html?id=${apt.id}'" role="button" tabindex="0">
        <header class="apartment-card-header">
          <div>
            <h2 class="apartment-name">${apt.name}</h2>
            <div class="apartment-name-en">${apt.name_en}</div>
          </div>
          <span class="apartment-status-badge">${apt.sale_status}</span>
        </header>

        <div class="apartment-meta">
          <div class="apartment-meta-row">
            <span class="apartment-meta-label">위치</span>
            <span class="apartment-meta-value">${apt.location}</span>
          </div>
          <div class="apartment-meta-row">
            <span class="apartment-meta-label">규모</span>
            <span class="apartment-meta-value">${apt.scale}</span>
          </div>
          <div class="apartment-meta-row">
            <span class="apartment-meta-label">세대수</span>
            <span class="apartment-meta-value">총 ${apt.households_total}세대 · 일반분양 ${apt.households_general}세대</span>
          </div>
          <div class="apartment-meta-row">
            <span class="apartment-meta-label">입주</span>
            <span class="apartment-meta-value">${apt.move_in}</span>
          </div>
        </div>

        <ul class="apartment-highlights">
          ${apt.highlights.slice(0, 3).map(h => `<li>${h}</li>`).join('')}
        </ul>

        <div class="apartment-developer">
          시행 ${apt.developer} · 시공 ${apt.constructor}
        </div>

        <div class="apartment-vr-button">
          360 VR로 단지 둘러보기
          <span class="arrow">→</span>
        </div>
      </article>
    `).join('');

    section.innerHTML = `
      <div class="section-inner">
        <h2 class="section-title">${apartmentList.length}개 분양 단지</h2>
        ${cardsHtml}
      </div>
    `;
  }
})();
