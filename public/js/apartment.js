// 단지 추가 시 data/busan.json의 apartments에 신규 단지 추가 + 해당 구 apartment_ids에 ID 추가
// 동별 사진 추가 시 captured: false → true 변경 + scenes 배열 채우기

(function () {
  const PASSWORD = 'sj360vr';
  const FREE_VIEW_LIMIT = 2;

  const params = new URLSearchParams(window.location.search);
  const apartmentId = params.get('id') || 'venuv';

  fetch('data/busan.json')
    .then(r => r.json())
    .then(data => {
      const apt = data.apartments[apartmentId];
      if (!apt) {
        location.href = 'index.html';
        return;
      }
      const district = data.districts.find(d => d.id === apt.district_id);

      document.title = `${apt.name} 360 VR | SJ부동산`;

      if (district) {
        document.getElementById('apt-breadcrumb').innerHTML =
          `<a href="district.html?d=${apt.district_id}" class="back-link">← ${district.name}</a>`;
      }

      init(apt);
    })
    .catch(e => console.error('데이터 로드 실패:', e));

  function init(apt) {
    renderComplexHeader(apt);
    renderHighlights(apt);
    renderUnitBreakdown(apt);
    renderTransitInfra(apt);
    renderSitemap(apt);
    renderBuildings(apt);
    initViewer();
    initModalEvents();
  }

  function renderComplexHeader(apt) {
    const displayUrl = apt.official_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const locShort = apt.location.replace('부산광역시 ', '').replace('번지 일원', '').replace('번지', '');
    document.getElementById('complex-header').innerHTML = `
      <div class="section-inner">
        <h1 class="complex-name">${apt.name}</h1>
        <p class="complex-name-en">${apt.name_en}</p>
        <div class="complex-meta">
          <span>위치 · ${locShort}</span>
          <span>규모 · ${apt.scale} / ${apt.households_total}세대</span>
          <span>시행 · ${apt.developer}</span>
          <span>시공 · ${apt.constructor}</span>
          <span>분양 · ${apt.sale_status}</span>
          <span>입주 · ${apt.move_in}</span>
        </div>
        <a href="${apt.official_url}" target="_blank" rel="noopener noreferrer" class="complex-link">${displayUrl} ↗</a>
      </div>
    `;
  }

  function renderHighlights(apt) {
    const cards = apt.highlights
      .map(h => `
        <div class="highlight-card">
          <div class="highlight-bar"></div>
          <p>${h}</p>
        </div>
      `)
      .join('');

    document.getElementById('highlights-section').innerHTML = `
      <div class="section-inner">
        <h2 class="section-title">단지 특징</h2>
        <div class="highlights-grid">${cards}</div>
        <p class="transit-info">${apt.transit}</p>
      </div>
    `;
  }

  function renderUnitBreakdown(apt) {
    if (!apt.unit_breakdown || apt.unit_breakdown.length === 0) return;
    const cards = apt.unit_breakdown.map(u => `
      <div class="unit-card">
        <p class="unit-size">${u.size}</p>
        <p class="unit-type">${u.type_count}</p>
        <p class="unit-households">${u.households}세대</p>
      </div>
    `).join('');
    document.getElementById('unit-breakdown-section').innerHTML = `
      <div class="unit-breakdown-inner">
        <h2 class="section-title">평형 구성</h2>
        <div class="unit-grid">${cards}</div>
        <p class="unit-meta">일반공급 ${apt.households_general}세대 포함 총 ${apt.households_total}세대</p>
      </div>
    `;
  }

  function renderTransitInfra(apt) {
    if (!apt.transit_infra || apt.transit_infra.length === 0) return;
    const items = apt.transit_infra.map(t => `<li>${t}</li>`).join('');
    document.getElementById('transit-infra-section').innerHTML = `
      <div class="transit-infra-inner">
        <h2 class="section-title">입지 · 교통</h2>
        <ul class="infra-list">${items}</ul>
      </div>
    `;
  }

  function renderSitemap(apt) {
    const W = 180, H = 120, gap = 16;
    const blds = apt.buildings_data;
    const totalW = blds.length * W + (blds.length - 1) * gap;

    const rects = blds.map((b, i) => {
      const x = i * (W + gap);
      const fill = b.captured ? 'var(--accent)' : 'var(--border)';
      const textFill = b.captured ? '#FFFFFF' : 'var(--text-muted)';
      const status = b.captured ? '촬영 완료' : '촬영 예정';
      return `
        <g onclick="window._scrollToBuilding('${b.id}')" style="cursor:pointer" role="button" aria-label="${b.name}으로 이동">
          <rect x="${x}" y="0" width="${W}" height="${H}" rx="4" fill="${fill}"/>
          <text x="${x + W / 2}" y="${H / 2 - 8}" text-anchor="middle" dominant-baseline="middle"
            font-family="Pretendard,system-ui,sans-serif" font-size="15" font-weight="500" fill="${textFill}">${b.name}</text>
          <text x="${x + W / 2}" y="${H / 2 + 14}" text-anchor="middle" dominant-baseline="middle"
            font-family="Pretendard,system-ui,sans-serif" font-size="11" fill="${textFill}" opacity="0.8">${status}</text>
        </g>
      `;
    }).join('');

    document.getElementById('sitemap-section').innerHTML = `
      <div class="section-inner">
        <h2 class="section-title">단지 배치도</h2>
        <div class="sitemap-wrapper">
          <svg viewBox="0 0 ${totalW} ${H}" width="${totalW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
            ${rects}
          </svg>
        </div>
      </div>
    `;
  }

  function renderBuildings(apt) {
    const section = document.getElementById('buildings-section');
    const inner = document.createElement('div');
    inner.className = 'section-inner';
    inner.innerHTML = `
      <h2 class="section-title">동별 조망 둘러보기</h2>
      <p class="section-desc">드론으로 촬영한 실제 분양 현장 360도 조망입니다</p>
    `;

    apt.buildings_data.forEach(b => {
      const card = document.createElement('div');
      card.className = 'building-card';
      card.id = 'building-' + b.id;

      const badge = b.captured
        ? `<span class="badge badge-captured"><span class="dot dot-green"></span>촬영 완료</span>`
        : `<span class="badge badge-pending"><span class="dot dot-gray"></span>촬영 예정</span>`;

      card.innerHTML = `
        <div class="building-header">
          <span class="building-name">${b.name}</span>
          ${badge}
        </div>
      `;

      if (b.captured) {
        const btnWrap = document.createElement('div');
        btnWrap.className = 'height-buttons';
        b.scenes.forEach(scene => {
          const btn = document.createElement('button');
          btn.className = 'height-btn';
          btn.textContent = scene.height;
          btn.onclick = () => tryViewVR(scene, b.name, btn);
          btnWrap.appendChild(btn);
        });
        card.appendChild(btnWrap);
      } else {
        const p = document.createElement('p');
        p.className = 'pending-text';
        p.textContent = '촬영 일정 조율 중입니다';
        card.appendChild(p);
      }

      inner.appendChild(card);
    });

    section.appendChild(inner);
  }

  function initViewer() {
    document.getElementById('viewer-section').innerHTML = `
      <div class="section-inner">
        <div class="viewer-placeholder">
          <p>위 버튼을 눌러 360 VR을 시작하세요</p>
        </div>
      </div>
    `;
  }

  let _activeBtn = null;

  function tryViewVR(scene, buildingName, btn) {
    const unlocked = sessionStorage.getItem('sj_unlocked') === 'true';
    const viewCount = parseInt(sessionStorage.getItem('sj_view_count') || '0', 10);

    if (unlocked) {
      setActiveBtn(btn);
      showVR(scene, buildingName);
      return;
    }

    if (viewCount < FREE_VIEW_LIMIT) {
      sessionStorage.setItem('sj_view_count', String(viewCount + 1));
      setActiveBtn(btn);
      showVR(scene, buildingName);
      return;
    }

    // 3번째 시도 → 모달 표시
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('modalPassword').focus();
  }

  function setActiveBtn(btn) {
    if (_activeBtn) _activeBtn.classList.remove('active');
    _activeBtn = btn;
    btn.classList.add('active');
  }

  function showVR(scene, buildingName) {
    const viewer = document.getElementById('viewer-section');
    const embedUrl = scene.url + '&embed=true';
    viewer.innerHTML = `
      <div class="section-inner">
        <p class="viewer-info">${buildingName} 지상 ${scene.height} 360 조망</p>
        <div class="viewer-active">
          <iframe src="${embedUrl}" class="viewer-iframe" allowfullscreen frameborder="0"
            allow="vr; xr; accelerometer; gyroscope; fullscreen"></iframe>
        </div>
      </div>
    `;
    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitPassword() {
    const input = document.getElementById('modalPassword').value;
    if (input === PASSWORD) {
      sessionStorage.setItem('sj_unlocked', 'true');
      closeModal();
    } else {
      const errEl = document.getElementById('modalError');
      errEl.style.display = 'block';
      setTimeout(() => { errEl.style.display = 'none'; }, 3000);
    }
  }

  function closeModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('modalPassword').value = '';
    document.getElementById('modalError').style.display = 'none';
  }

  function initModalEvents() {
    document.getElementById('modalPassword').addEventListener('keypress', e => {
      if (e.key === 'Enter') submitPassword();
    });
    document.getElementById('passwordModal').addEventListener('click', e => {
      if (e.target.id === 'passwordModal') closeModal();
    });
  }

  window.submitPassword = submitPassword;
  window.closeModal = closeModal;

  window._scrollToBuilding = id => {
    document.getElementById('building-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
})();
