// 단지 추가 시 data/busan.json의 apartments에 신규 단지 추가 + 해당 구 apartment_ids에 ID 추가
// 동별 사진 추가 시 node scripts/scan-photos.js 실행 → buildings_data 자동 갱신

(function () {
  const PASSWORD        = 'sj360vr';
  const FREE_VIEW_LIMIT = 2;
  const STORAGE_KEY     = 'sj_unlocked';

  // 단지별 유튜브 영상 map (없으면 placeholder)
  const aptVideos = {
    'venuve': { id: 'UDV4SFvFjX8', start: 159 }
  };

  const params      = new URLSearchParams(window.location.search);
  const apartmentId = params.get('id') || 'venuve';

  fetch('data/busan.json')
    .then(r => r.json())
    .then(data => {
      const apt = data.apartments[apartmentId];
      if (!apt) { location.href = 'index.html'; return; }

      const district = data.districts.find(d => d.id === apt.district_id);
      document.title = `${apt.name} 360 VR | SJ부동산`;

      if (district) {
        document.getElementById('apt-breadcrumb').innerHTML =
          `<a href="district.html?d=${apt.district_id}" class="back-link">← ${district.name}</a>`;
      }
      init(apt);
    })
    .catch(e => console.error('데이터 로드 실패:', e));

  /* ════════════════════════════════════════
     init
  ════════════════════════════════════════ */
  function init(apt) {
    renderComplexHeader(apt);
    renderHighlights(apt);
    renderUnitBreakdown(apt);
    renderTransitInfra(apt);
    renderSitemap(apt);
    renderBuildings(apt);
    renderFacilities(apt);
    initViewer();
    initModalEvents();
  }

  /* ════════════════════════════════════════
     단지 헤더
  ════════════════════════════════════════ */
  function renderComplexHeader(apt) {
    const displayUrl = apt.official_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const locShort   = apt.location
      .replace('부산광역시 ', '')
      .replace('번지 일원', '')
      .replace('번지', '');

    const vid = aptVideos[apartmentId] || null;
    const videoSlotHtml = vid
      ? `<div class="aspect-video" style="margin-top:24px;max-width:720px;">
           <iframe
             src="https://www.youtube.com/embed/${vid.id}?start=${vid.start}&rel=0&modestbranding=1"
             allowfullscreen loading="lazy" title="${apt.name} 현장 영상">
           </iframe>
         </div>`
      : `<div class="aspect-video video-placeholder" style="margin-top:24px;max-width:720px;">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
             <path d="M3 3l18 18M10.29 10.29A3 3 0 0 0 12 15a3 3 0 0 0 2.71-1.71M12 9a3 3 0 0 1 3 3"/>
             <path d="M9 6.527A10.95 10.95 0 0 1 12 6c4 0 7.333 2.333 10 7-1.09 1.905-2.324 3.419-3.662
               4.527M4.547 9.532C3.272 10.619 2.1 12.049 1 14c2.667 4.667 6 7 10 7a10.88 10.88 0 0 0
               3.528-.578"/>
           </svg>
           <p style="color:#666;font-size:13px;margin:0;">영상 준비중</p>
         </div>`;

    document.getElementById('complex-header').innerHTML = `
      <div class="section-inner">
        <h1 class="complex-name">${apt.name}</h1>
        <p class="complex-name-en">${apt.name_en || ''}</p>
        ${videoSlotHtml}
        <div class="complex-meta" style="margin-top:24px;">
          <span>위치 · ${locShort}</span>
          <span>규모 · ${apt.scale} / ${apt.households_total}세대</span>
          <span>시행 · ${apt.developer}</span>
          <span>시공 · ${apt.constructor}</span>
          <span>분양 · ${apt.sale_status}</span>
          <span>입주 · ${apt.move_in}</span>
        </div>
        <a href="${apt.official_url}" target="_blank" rel="noopener noreferrer"
          class="complex-link">${displayUrl} ↗</a>
      </div>
    `;
  }

  /* ════════════════════════════════════════
     단지 특징
  ════════════════════════════════════════ */
  function renderHighlights(apt) {
    const cards = apt.highlights.map(h => `
      <div class="highlight-card">
        <div class="highlight-bar"></div>
        <p>${h}</p>
      </div>
    `).join('');

    document.getElementById('highlights-section').innerHTML = `
      <div class="section-inner">
        <h2 class="section-title">단지 특징</h2>
        <div class="highlights-grid">${cards}</div>
        ${apt.transit ? `<p class="transit-info">${apt.transit}</p>` : ''}
      </div>
    `;
  }

  /* ════════════════════════════════════════
     평형 구성
  ════════════════════════════════════════ */
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

  /* ════════════════════════════════════════
     입지 · 교통
  ════════════════════════════════════════ */
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

  /* ════════════════════════════════════════
     단지 배치도
  ════════════════════════════════════════ */
  function renderSitemap(apt) {
    const W = 180, H = 120, gap = 16;
    const blds   = apt.buildings_data;
    const totalW = blds.length * W + (blds.length - 1) * gap;

    const rects = blds.map((b, i) => {
      const x        = i * (W + gap);
      const fill     = b.captured ? 'var(--accent)' : 'var(--border)';
      const textFill = b.captured ? '#FFFFFF' : 'var(--text-muted)';
      const status   = b.captured ? '촬영 완료' : '촬영 예정';
      return `
        <g onclick="window._scrollToBuilding('${b.id}')" style="cursor:pointer"
          role="button" aria-label="${b.name}으로 이동">
          <rect x="${x}" y="0" width="${W}" height="${H}" rx="4" fill="${fill}"/>
          <text x="${x + W/2}" y="${H/2 - 8}" text-anchor="middle" dominant-baseline="middle"
            font-family="Pretendard,system-ui,sans-serif" font-size="15"
            font-weight="500" fill="${textFill}">${b.name}</text>
          <text x="${x + W/2}" y="${H/2 + 14}" text-anchor="middle" dominant-baseline="middle"
            font-family="Pretendard,system-ui,sans-serif" font-size="11"
            fill="${textFill}" opacity="0.8">${status}</text>
        </g>`;
    }).join('');

    document.getElementById('sitemap-section').innerHTML = `
      <div class="section-inner">
        <h2 class="section-title">단지 배치도</h2>
        <div class="sitemap-wrapper">
          <svg viewBox="0 0 ${totalW} ${H}" width="${totalW}" height="${H}"
            xmlns="http://www.w3.org/2000/svg">${rects}</svg>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════
     동별 조망 (호라인 탭 지원)
  ════════════════════════════════════════ */
  function renderBuildings(apt) {
    const section = document.getElementById('buildings-section');
    const inner   = document.createElement('div');
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
        const hasLines = b.scenes.some(s => s.line);
        const wrap = document.createElement('div');
        wrap.style.marginTop = '24px';

        if (hasLines) {
          // ── 호라인 탭 모드 ──
          const lineMap = new Map();
          b.scenes.forEach(s => {
            if (!lineMap.has(s.line)) lineMap.set(s.line, []);
            lineMap.get(s.line).push(s);
          });

          const tabRow    = document.createElement('div');
          tabRow.className = 'line-tabs';

          const heightRow  = document.createElement('div');
          heightRow.className = 'height-buttons';

          let firstTab = true;
          lineMap.forEach((scenes, lineKey) => {
            const tab = document.createElement('button');
            tab.className = 'line-tab' + (firstTab ? ' active' : '');
            tab.textContent = lineKey + '호라인';
            tab.addEventListener('click', () => {
              tabRow.querySelectorAll('.line-tab').forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
              fillHeightBtns(heightRow, scenes, b, apt);
            });
            tabRow.appendChild(tab);
            if (firstTab) { fillHeightBtns(heightRow, scenes, b, apt); firstTab = false; }
          });

          wrap.appendChild(tabRow);
          wrap.appendChild(heightRow);
        } else {
          // ── 고도 버튼만 (기존 베뉴브/남천/센텀 방식) ──
          const heightRow = document.createElement('div');
          heightRow.className = 'height-buttons';
          b.scenes.forEach(scene => {
            const btn = document.createElement('button');
            btn.className = 'height-btn';
            btn.textContent = scene.height;
            btn.addEventListener('click', () => tryViewVR(scene, b, apt, btn));
            heightRow.appendChild(btn);
          });
          wrap.appendChild(heightRow);
        }

        card.appendChild(wrap);
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

  function fillHeightBtns(container, scenes, building, apt) {
    container.innerHTML = '';
    scenes.forEach(scene => {
      const btn = document.createElement('button');
      btn.className = 'height-btn';
      btn.textContent = scene.height;
      btn.addEventListener('click', () => tryViewVR(scene, building, apt, btn));
      container.appendChild(btn);
    });
  }

  /* ════════════════════════════════════════
     부대시설 섹션
  ════════════════════════════════════════ */
  function renderFacilities(apt) {
    if (!apt.facilities_data || apt.facilities_data.length === 0) return;
    const captured = apt.facilities_data.filter(f => f.captured && f.scenes && f.scenes.length > 0);
    if (captured.length === 0) return;

    const section = document.getElementById('facilities-section');
    if (!section) return;

    const inner = document.createElement('div');
    inner.className = 'section-inner';
    inner.innerHTML = `
      <h2 class="section-title">부대시설 360 VR</h2>
      <p class="section-desc">단지 내 부대시설을 360°로 둘러보세요</p>
    `;

    const grid = document.createElement('div');
    grid.className = 'facilities-grid';

    captured.forEach(facility => {
      facility.scenes.forEach(scene => {
        const card = document.createElement('div');
        card.className = 'facility-card';
        card.innerHTML = `<p class="facility-name">${scene.name}</p>`;
        card.addEventListener('click', () => {
          const facScene = { ...scene, facilityId: facility.id };
          tryViewVR(facScene, null, apt, null);
        });
        grid.appendChild(card);
      });
    });

    inner.appendChild(grid);
    section.appendChild(inner);
  }

  /* ════════════════════════════════════════
     뷰어 초기화
  ════════════════════════════════════════ */
  function initViewer() {
    document.getElementById('viewer-section').innerHTML = `
      <div class="section-inner">
        <div class="viewer-placeholder">
          <p>위 버튼을 눌러 360 VR을 시작하세요</p>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════
     VR 시도 (인증 게이트)
  ════════════════════════════════════════ */
  let _activeBtn = null;

  function tryViewVR(scene, building, apt, btn) {
    const unlocked  = localStorage.getItem(STORAGE_KEY) === 'true';
    const viewCount = parseInt(sessionStorage.getItem('sj_view_count') || '0', 10);

    if (unlocked) {
      setActiveBtn(btn);
      showVR(scene, building, apt);
      return;
    }

    if (viewCount < FREE_VIEW_LIMIT) {
      sessionStorage.setItem('sj_view_count', String(viewCount + 1));
      setActiveBtn(btn);
      showVR(scene, building, apt);
      return;
    }

    // 한도 초과 → 모달
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('modalPassword').focus();
  }

  function setActiveBtn(btn) {
    if (_activeBtn) _activeBtn.classList.remove('active');
    _activeBtn = btn;
    if (btn) btn.classList.add('active');
  }

  /* ════════════════════════════════════════
     VR 표시 (워터마크 + 호라인 + 부대시설 지원)
  ════════════════════════════════════════ */
  function showVR(scene, building, apt) {
    const viewer        = document.getElementById('viewer-section');
    const apartmentTitle = apt.short_name || apt.name;

    if (apt.hosting === 'self') {
      let rawPath, infoHtml, fullTitle;

      if (building) {
        // 동별 드론 조망
        rawPath = `photos/${apt.photos_folder}/${building.id}/${scene.file}`;
        const lineHtml = scene.line
          ? `<span class="viewer-info-divider">·</span>
             <span class="viewer-info-building">${scene.line}호라인</span>`
          : '';
        infoHtml = `
          <span class="viewer-info-divider">·</span>
          <span class="viewer-info-building">${building.name}</span>
          ${lineHtml}
          <span class="viewer-info-divider">·</span>
          <span class="viewer-info-height">지상 ${scene.height}</span>
        `;
        fullTitle = `${apartmentTitle} ${building.name}${scene.line ? ' ' + scene.line + '호라인' : ''} 지상${scene.height}`;
      } else {
        // 부대시설
        rawPath = `photos/${apt.photos_folder}/${scene.facilityId}/${scene.file}`;
        infoHtml = `
          <span class="viewer-info-divider">·</span>
          <span class="viewer-info-building">${scene.name}</span>
        `;
        fullTitle = `${apartmentTitle} ${scene.name}`;
      }

      const imagePath = encodeURI(rawPath);

      viewer.innerHTML = `
        <div class="section-inner viewer-section-inner">
          <div class="viewer-info-bar">
            <span class="viewer-info-apartment">${apartmentTitle}</span>
            ${infoHtml}
          </div>
          <div class="viewer-container">
            <div id="pannellum-viewer"></div>
          </div>
        </div>
      `;

      pannellum.viewer('pannellum-viewer', {
        type:         'equirectangular',
        panorama:     imagePath,
        title:        fullTitle,
        autoLoad:     true,
        autoRotate:   -2,
        compass:      false,
        showControls: true,
        hfov:    100,
        minHfov: 50,
        maxHfov: 120,
        hotSpots: [
          {
            pitch:  -25,
            yaw:    0,
            type:   'info',
            text:   '하이엔드 아파트 전문 SJ부동산 | 전수진 010-2879-5452',
            URL:    'tel:01028795452'
          }
        ]
      });

    } else {
      // Panoee (legacy 호환)
      const embedUrl = scene.url + '&embed=true';
      viewer.innerHTML = `
        <div class="section-inner">
          <div class="viewer-info-bar">
            <span class="viewer-info-apartment">${apartmentTitle}</span>
            <span class="viewer-info-divider">·</span>
            <span class="viewer-info-building">${building.name}</span>
            <span class="viewer-info-divider">·</span>
            <span class="viewer-info-height">지상 ${scene.height}</span>
          </div>
          <div class="viewer-active">
            <iframe src="${embedUrl}" class="viewer-iframe" allowfullscreen frameborder="0"
              allow="vr; xr; accelerometer; gyroscope; fullscreen"></iframe>
          </div>
        </div>
      `;
    }

    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ════════════════════════════════════════
     비밀번호 모달
  ════════════════════════════════════════ */
  function submitPassword() {
    const input = document.getElementById('modalPassword').value;
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'true');
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

  window.submitPassword      = submitPassword;
  window.closeModal          = closeModal;
  window._scrollToBuilding   = id => {
    document.getElementById('building-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
})();
