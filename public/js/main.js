(function () {
  // ── 히어로 슬라이드쇼 (5초마다 자동 전환) ──
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length > 1) {
    let currentSlide = 0;
    setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 5000);
  }

  fetch('data/busan.json')
    .then(r => r.json())
    .then(data => {
      const apts = Object.values(data.apartments);
      renderFeatured(apts);
      renderNewVR(apts);
      renderDistricts(data);
    })
    .catch(e => console.error('데이터 로드 실패:', e));

  function getYoutubeEmbedId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
    return m ? m[1] : null;
  }

  // ── 핫한 VR (is_featured) ──
  function renderFeatured(apts) {
    const section = document.getElementById('hot-pick-section');
    const grid    = document.getElementById('hot-pick-grid');
    if (!section || !grid) return;

    const featured = apts.filter(a => a.is_featured);
    if (featured.length === 0) { section.style.display = 'none'; return; }

    // 히어로 CTA를 첫 핫한 단지로 연결
    const heroCta = document.getElementById('hero-cta');
    if (heroCta) heroCta.href = 'apartment.html?id=' + featured[0].id;

    grid.innerHTML = featured.map(a => {
      const embedId = getYoutubeEmbedId(a.youtube_url);
      const media = embedId
        ? `<div class="aspect-video">
             <iframe class="hot-pick-iframe"
               src="https://www.youtube.com/embed/${embedId}?rel=0&modestbranding=1"
               title="${a.name}" frameborder="0" loading="lazy"
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
               allowfullscreen></iframe>
           </div>`
        : `<div class="aspect-video video-placeholder">
             <i class="ti ti-video-off" style="font-size:28px;color:#aaa;"></i>
             <p style="font-size:13px;color:#888;">영상 준비중</p>
           </div>`;
      const loc  = a.card_loc || a.location.replace('부산광역시 ', '부산 ').split('(')[0].trim();
      const desc = a.card_desc || `${a.scale} · ${a.households_total}세대`;
      return `
        <a href="apartment.html?id=${a.id}" class="hot-pick-card" aria-label="${a.name} VR 보기">
          <div class="hot-pick-video">
            <span class="hot-pick-badge">🔥 핫한 VR</span>
            ${media}
          </div>
          <div class="hot-pick-body">
            <p class="hot-pick-loc">${loc}</p>
            <h3 class="hot-pick-name">${a.name}</h3>
            <p class="hot-pick-desc">${desc}</p>
            <span class="hot-pick-cta">360° 드론 조망 보기 →</span>
          </div>
        </a>`;
    }).join('');
  }

  // ── 신규 VR (is_new) ──
  function renderNewVR(apts) {
    const section = document.getElementById('new-vr-section');
    const scroll  = document.getElementById('new-vr-scroll');
    if (!section || !scroll) return;

    const news = apts.filter(a => a.is_new);
    if (news.length === 0) { section.style.display = 'none'; return; }

    scroll.innerHTML = news.map(a => {
      const loc  = a.card_loc || a.location.replace('부산광역시 ', '부산 ').split('(')[0].trim();
      const meta = a.card_meta || `${a.households_total}세대`;
      return `
        <a href="apartment.html?id=${a.id}" class="new-vr-card">
          <div class="new-vr-img-wrap">
            <div class="new-vr-gradient"></div>
            <span class="new-vr-badge">✨ NEW</span>
          </div>
          <div class="new-vr-body">
            <p class="new-vr-loc">${loc}</p>
            <h3 class="new-vr-name">${a.name}</h3>
            <p class="new-vr-meta">${meta}</p>
          </div>
        </a>`;
    }).join('');
  }

  function renderDistricts(data) {
    const grid = document.getElementById('districts-grid');

    data.districts.forEach(d => {
      const hasApts = d.apartment_ids.length > 0;
      const card = document.createElement('div');
      card.className = 'district-card' + (hasApts ? ' district-card--active' : ' district-card--coming');

      const metaHtml = hasApts
        ? `<span class="card-meta card-meta--active">${d.apartment_ids.length}개 단지 · 보기 →</span>`
        : `<span class="card-meta card-meta--empty">준비 중</span>`;

      card.innerHTML = `
        <p class="card-name-en">${d.name_en}</p>
        <h3 class="card-name">${d.name}</h3>
        <p class="card-subtitle">${d.subtitle}</p>
        ${metaHtml}
      `;

      if (hasApts) {
        card.addEventListener('click', () => {
          location.href = 'district.html?d=' + d.id;
        });
      }

      grid.appendChild(card);
    });
  }
})();
