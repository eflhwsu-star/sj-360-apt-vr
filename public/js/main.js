(function () {
  fetch('data/busan.json')
    .then(r => r.json())
    .then(data => renderDistricts(data))
    .catch(e => console.error('데이터 로드 실패:', e));

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
