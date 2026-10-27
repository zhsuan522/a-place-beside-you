const STORAGE_KEY = 'a-place-beside-you.prototype.v1';
const PLANET_ROOT = `${import.meta.env.BASE_URL}assets/packs/kenney/planets/Planets/`;
const PLANET_NAMES = ['planet00.png', 'planet01.png', 'planet02.png', 'planet03.png', 'planet04.png', 'planet05.png', 'planet06.png', 'planet07.png', 'planet08.png', 'planet09.png'];

const scenes = {
  forest: { label: '森林', symbol: '🌲', caption: '松針之間的微風' },
  shore: { label: '海邊', symbol: '🌊', caption: '潮汐留下的細沙' },
};
const supplies = {
  toy: { label: '喜歡的玩具', symbol: '🧸', souvenir: '一枚小小的星星鈴鐺' },
  treat: { label: '一份點心', symbol: '🍪', souvenir: '一顆甜甜的月光糖' },
  keepsake: { label: '熟悉的小物', symbol: '🧣', souvenir: '一片柔軟的旅途葉片' },
};
const durations = [6, 12, 24];

function freshState() {
  return { pet: { name: '我的毛孩', photo: '' }, planets: [], trips: [], activeTrip: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return freshState();
    return {
      ...freshState(),
      ...saved,
      pet: { ...freshState().pet, ...(saved.pet || {}) },
      planets: Array.isArray(saved.planets) ? saved.planets : [],
      trips: Array.isArray(saved.trips) ? saved.trips : [],
      activeTrip: saved.activeTrip || null,
    };
  } catch {
    return freshState();
  }
}

function safeText(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function localDate(time) {
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time));
}

function countdownText(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function planetImage(index = 0) {
  return `${PLANET_ROOT}${PLANET_NAMES[index % PLANET_NAMES.length]}`;
}

function getPlanet(state, id) {
  return state.planets.find((planet) => planet.id === id);
}

function postcardText(state, trip) {
  const scene = scenes[trip.scene] || scenes.forest;
  const supply = supplies[trip.supply] || supplies.keepsake;
  const name = state.pet.name || '親愛的你';
  const landscape = trip.scene === 'shore'
    ? '海浪把天空的顏色，一點一點收進沙灘。走在熟悉的風裡時，我想起了你。'
    : '樹葉輕輕搖晃，午後的光落在草地上。走在熟悉的風裡時，我想起了你。';
  return `親愛的 ${name}：\n\n${landscape}\n\n謝謝你把這片風景送給我。我帶回了${supply.souvenir}，留給你慢慢收藏。\n\n不必急著想我。想念的時候，就到星空裡坐一會兒。`;
}

function icon(name) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    map: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    album: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m20 15-5-5L5 20"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.home}</svg>`;
}

export function mountGameUI() {
  let state = loadState();
  let page = 'home';
  let draft = null;
  let toastTimer;
  const root = document.querySelector('#ui-root');
  const isDevelopment = import.meta.env.DEV;

  function refreshTripStatus() {
    const trip = state.activeTrip;
    if (trip?.status === 'travelling' && Date.now() >= trip.arrivesAt) {
      trip.status = 'pending';
      trip.arrivedAt = Date.now();
      saveState(state);
      if (page === 'plan') page = 'home';
      render();
    }
    updateCountdowns();
  }

  function showToast(message) {
    const toast = root.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function updateCountdowns() {
    const trip = state.activeTrip;
    if (trip?.status !== 'travelling') return;
    const text = countdownText(trip.arrivesAt - Date.now());
    root.querySelectorAll('[data-countdown]').forEach((element) => { element.textContent = text; });
  }

  function currentJourneyCard() {
    const trip = state.activeTrip;
    if (!trip) {
      return `<div class="welcome-block"><span class="eyebrow">一趟旅程，慢慢抵達</span><h2>要替回憶安排一段旅程嗎？</h2><p>選一個熟悉的地方、一件想帶上的小物。沒有正確答案，也不需要趕路。</p><button class="primary-button" data-action="plan">準備一趟旅程 <span>${icon('arrow')}</span></button><div class="gentle-note">你可以隨時回來。想念不需要期限。</div></div>`;
    }
    const planet = getPlanet(state, trip.planetId);
    if (trip.status === 'pending') {
      return `<div class="welcome-block"><span class="status-pill arrived"><span class="status-dot"></span> 旅程已抵達</span><h2>${safeText(state.pet.name)}寄來了一張明信片</h2><p>${safeText(planet?.name || '遠方星球')}的風景已經收進信裡。讀完後，下一趟旅程就會為你留出位置。</p><button class="primary-button" data-nav="mail">去信箱讀一讀 <span>${icon('arrow')}</span></button><div class="gentle-note">如果今天還沒準備好，明信片會一直在這裡等你。</div></div>`;
    }
    return `<div class="welcome-block traveling-block"><span class="status-pill traveling"><span class="status-dot"></span> 旅程進行中</span><h2>${safeText(planet?.name || '遠方星球')}</h2><p>${safeText(scenes[trip.scene]?.label || '星球')}的旅途正在星光中慢慢前進。</p><div class="countdown-wrap"><span>預計抵達倒數</span><strong data-countdown>${countdownText(trip.arrivesAt - Date.now())}</strong></div><p class="arrival-copy">約在 ${localDate(trip.arrivesAt)} 抵達。晚一點回來也沒關係。</p><button class="secondary-button" data-nav="map">看看星圖 <span>${icon('arrow')}</span></button>${isDevelopment ? '<button class="dev-preview" data-action="preview">原型快速預覽：直接收到明信片</button>' : ''}</div>`;
  }

  function renderHome() {
    const memories = state.trips.length;
    const planets = state.planets.length;
    return `<div class="view-heading"><div><span class="eyebrow">今天的小樹屋</span><h1>星光替你留著位置。</h1></div><span class="mood-mark" aria-hidden="true">✦</span></div>${currentJourneyCard()}<div class="home-stats"><div><strong>${planets}</strong><span>顆星球</span></div><div><strong>${memories}</strong><span>封已收藏的明信片</span></div><div class="home-privacy">${icon('lock')}<span>只有你能看見</span></div></div>`;
  }

  function renderPlan() {
    const planets = state.planets;
    const selected = draft?.planetId || 'new';
    const existing = planets.map((planet) => `<option value="${safeText(planet.id)}" ${selected === planet.id ? 'selected' : ''}>${safeText(planet.name)}</option>`).join('');
    return `<div class="view-heading"><div><button class="back-link" data-nav="home">← 回到小樹屋</button><span class="eyebrow">替回憶找一顆星球</span><h1>安排一趟旅程</h1></div><span class="mood-mark">✧</span></div><form class="trip-form" id="trip-form" novalidate>
      <div class="form-section"><label class="field-label" for="planet-select">這次要去哪裡？</label><select id="planet-select" class="text-field" data-field="planetId"><option value="new" ${selected === 'new' ? 'selected' : ''}>＋ 建立一顆新星球</option>${existing}</select>${selected === 'new' ? `<input class="text-field planet-name-field" data-field="planetName" maxlength="32" placeholder="為這顆星球取個名字" value="${safeText(draft?.planetName || '')}" aria-label="星球名稱">` : `<div class="field-hint">這趟旅程會回到這顆熟悉的星球。</div>`}</div>
      <div class="form-section"><label class="field-label" for="memory-description">想起一個牠喜歡的地方</label><textarea id="memory-description" class="text-field text-area" data-field="description" maxlength="240" placeholder="例如：我們常在傍晚去海邊散步，看浪花慢慢退去。這段文字只留在你的私人相簿。">${safeText(draft?.description || '')}</textarea><div class="field-hint">可以留下一小段場景，也可以略過。之後請親自挑選最接近的插畫類型。</div></div>
      <div class="form-section"><span class="field-label">選一種最像的風景 <span class="required-hint">請選一項</span></span><div class="choice-grid scene-choices">${Object.entries(scenes).map(([key, scene]) => `<button type="button" class="choice-card ${draft?.scene === key ? 'selected' : ''}" data-action="choose" data-kind="scene" data-value="${key}" aria-pressed="${draft?.scene === key}"><span class="choice-symbol">${scene.symbol}</span><span><strong>${scene.label}</strong><small>${scene.caption}</small></span><span class="choice-check">✓</span></button>`).join('')}</div></div>
      <div class="form-section"><span class="field-label">想帶上一件什麼？ <span class="required-hint">不消耗任何資源</span></span><div class="choice-grid supply-choices">${Object.entries(supplies).map(([key, supply]) => `<button type="button" class="choice-card compact ${draft?.supply === key ? 'selected' : ''}" data-action="choose" data-kind="supply" data-value="${key}" aria-pressed="${draft?.supply === key}"><span class="choice-symbol">${supply.symbol}</span><strong>${supply.label}</strong><span class="choice-check">✓</span></button>`).join('')}</div></div>
      <div class="form-section"><span class="field-label">旅程會在什麼時候抵達？ <span class="required-hint">請選一個時間</span></span><div class="duration-row">${durations.map((hours) => `<button type="button" class="duration-choice ${draft?.hours === hours ? 'selected' : ''}" data-action="choose" data-kind="hours" data-value="${hours}" aria-pressed="${draft?.hours === hours}"><strong>${hours}</strong><span>小時</span></button>`).join('')}</div><div class="field-hint">關閉瀏覽器不會中斷旅程；晚回來也不會失去任何內容。</div></div>
      <div class="form-section"><label class="field-label" for="letter">想留一封信嗎？ <span class="required-hint">可以略過</span></label><textarea id="letter" class="text-field text-area short-area" data-field="letter" maxlength="500" placeholder="寫給牠的幾句話……">${safeText(draft?.letter || '')}</textarea><div class="field-hint">這封信只保存在你的私人相簿，不會收到回信。</div></div>
      <div class="form-actions"><button type="button" class="secondary-button" data-nav="home">先不安排</button><button type="submit" class="primary-button">送牠出發 <span>${icon('arrow')}</span></button></div><p class="local-note">這是可玩原型；資料目前只保存在這個瀏覽器。</p>
    </form>`;
  }

  function renderMap() {
    const active = state.activeTrip;
    const planets = state.planets;
    const cards = planets.map((planet, index) => {
      const isActive = active?.planetId === planet.id;
      const label = isActive ? (active.status === 'pending' ? '明信片待閱讀' : '旅程進行中') : `${state.trips.filter((trip) => trip.planetId === planet.id).length} 趟回憶`;
      const scene = scenes[planet.scene]?.label || '星球';
      return `<article class="planet-card ${isActive ? 'current' : ''}"><div class="planet-art"><img src="${planetImage(index)}" alt="" loading="lazy"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span></div><div class="planet-copy"><span class="eyebrow">${scene}・${safeText(label)}</span><h3>${safeText(planet.name)}</h3><p>${safeText(planet.description || '一顆為回憶留著的星球。')}</p>${isActive && active.status === 'travelling' ? `<span class="map-countdown" data-countdown>${countdownText(active.arrivesAt - Date.now())}</span>` : ''}</div></article>`;
    }).join('');
    return `<div class="view-heading"><div><span class="eyebrow">每一顆星，都有熟悉的風景</span><h1>旅程星圖</h1></div><span class="mood-mark">✧</span></div><p class="view-intro">這張星圖只屬於你。走過的路，會慢慢亮起來。</p>${planets.length ? `<div class="planet-list">${cards}</div><div class="map-path-note"><span>✦</span> 路線會隨著每封讀完的明信片延伸。</div>` : `<div class="empty-state"><div class="empty-orbit">✦</div><h2>星圖還在等第一顆星</h2><p>當你安排第一趟旅程，牠喜歡的地方就會成為一顆星球。</p><button class="primary-button" data-action="plan">開始建立星球 <span>${icon('arrow')}</span></button></div>`}`;
  }

  function renderMailbox() {
    const trip = state.activeTrip;
    if (!trip) {
      return `<div class="view-heading"><div><span class="eyebrow">把信放在這裡等你</span><h1>星際信箱</h1></div><span class="mood-mark">✉</span></div><div class="empty-state"><div class="mailbox-art">✉</div><h2>現在沒有待讀明信片</h2><p>下一趟旅程抵達後，這裡會放著一封只寫給你的信。沒有通知也沒關係，信不會走丟。</p><button class="secondary-button" data-nav="home">回到小樹屋 <span>${icon('arrow')}</span></button></div><div class="archive-shortcut"><span>之前讀過的信都收在相簿裡。</span><button class="text-button" data-nav="album">去相簿看看 →</button></div>`;
    }
    const planet = getPlanet(state, trip.planetId);
    if (trip.status === 'travelling') {
      return `<div class="view-heading"><div><span class="eyebrow">信還在路上</span><h1>星際信箱</h1></div><span class="mood-mark">✉</span></div><div class="mail-wait-card"><div class="letter-icon">✧</div><span class="status-pill traveling"><span class="status-dot"></span> 旅程進行中</span><h2>${safeText(planet?.name || '遠方星球')}</h2><p>明信片抵達後會一直留在信箱裡，等你準備好再讀。</p><div class="countdown-wrap"><span>預計抵達倒數</span><strong data-countdown>${countdownText(trip.arrivesAt - Date.now())}</strong></div><span class="arrival-copy">約在 ${localDate(trip.arrivesAt)} 抵達</span></div>${isDevelopment ? '<button class="dev-preview inline-preview" data-action="preview">原型快速預覽：直接收到明信片</button>' : ''}`;
    }
    const scene = scenes[trip.scene] || scenes.forest;
    const supply = supplies[trip.supply] || supplies.keepsake;
    return `<div class="view-heading"><div><span class="eyebrow">一封來自 ${safeText(planet?.name || '遠方')} 的信</span><h1>給 ${safeText(state.pet.name)}</h1></div><span class="mood-mark">✉</span></div><article class="postcard"><div class="postcard-art ${trip.scene}"><div class="postcard-stars">✦　·　✧　·</div><img src="${planetImage(trip.planetIndex || 0)}" alt="星球插畫"><span>${scene.symbol}</span></div><div class="postcard-details"><div class="postcard-stamp">抵達星際信箱<br>${localDate(trip.arrivedAt || trip.arrivesAt)}</div><span class="eyebrow">${scene.label}・旅途明信片</span><h2>${safeText(planet?.name || '遠方星球')}</h2><p class="postcard-letter">${safeText(postcardText(state, trip))}</p><div class="souvenir"><span class="souvenir-icon">${supply.symbol}</span><span><small>帶回來的紀念品</small><strong>${supply.souvenir}</strong></span></div>${trip.letter ? `<details class="your-letter"><summary>你出發前寫下的話</summary><p>${safeText(trip.letter)}</p></details>` : ''}<button class="primary-button full-button" data-action="read">收進相簿 <span>${icon('arrow')}</span></button><p class="letter-footnote">讀完後，這封明信片與紀念品會收進你的私人相簿。</p></div></article>`;
  }

  function renderAlbum() {
    const photo = state.pet.photo ? `<img class="pet-photo" src="${safeText(state.pet.photo)}" alt="${safeText(state.pet.name)}的照片">` : `<div class="pet-placeholder" aria-hidden="true">♡</div>`;
    const memories = state.trips.map((trip, index) => {
      const planet = getPlanet(state, trip.planetId);
      const scene = scenes[trip.scene] || scenes.forest;
      const supply = supplies[trip.supply] || supplies.keepsake;
      return `<article class="memory-card"><div class="memory-cover ${trip.scene}"><img src="${planetImage(index)}" alt=""><span>${scene.symbol}</span></div><div class="memory-content"><span class="eyebrow">${localDate(trip.readAt || trip.arrivedAt || trip.arrivesAt)}</span><h3>${safeText(planet?.name || '一顆星球')}</h3><p>${safeText(trip.description || scene.caption)}</p><div class="memory-souvenir">${supply.symbol} ${supply.souvenir}</div>${trip.letter ? `<details class="memory-letter"><summary>讀讀你寫的信</summary><p>${safeText(trip.letter)}</p></details>` : ''}</div></article>`;
    }).join('');
    return `<div class="view-heading"><div><span class="eyebrow">私人收藏・只有你能看見</span><h1>回憶相簿</h1></div><span class="mood-mark">♡</span></div><section class="profile-card"><div class="profile-photo-wrap">${photo}</div><div class="profile-fields"><label class="field-label" for="pet-name">毛孩的名字</label><input id="pet-name" class="text-field" data-field="pet-name" maxlength="32" value="${safeText(state.pet.name)}"><p>照片與文字只保存在這個瀏覽器，不會公開分享。</p></div><div class="photo-actions"><label class="upload-button" for="pet-photo">${state.pet.photo ? '更換照片' : '選擇照片'}</label><input id="pet-photo" class="visually-hidden" type="file" accept="image/*"><button class="text-button" data-action="${state.pet.photo ? 'remove-photo' : 'noop'}" ${state.pet.photo ? '' : 'disabled'}>移除</button></div></section><div class="album-section-heading"><div><span class="eyebrow">每一段旅程都被好好收著</span><h2>明信片與紀念品 <span class="count-badge">${state.trips.length}</span></h2></div></div>${memories ? `<div class="memory-list">${memories}</div>` : `<div class="empty-state compact-empty"><div class="empty-orbit">♡</div><h2>相簿還是空的</h2><p>讀完第一張明信片後，旅程和紀念品會一起收進這裡。</p><button class="secondary-button" data-nav="home">回到小樹屋</button></div>`}<section class="data-tools"><div><strong>你的資料，由你保管</strong><p>下載一份本機備份，或刪除這個原型存下的全部內容。</p></div><div class="data-buttons"><button class="secondary-button" data-action="export">下載資料備份</button><button class="text-button danger-text" data-action="clear-data">刪除本機資料</button></div></section>`;
  }

  function viewContent() {
    if (page === 'plan') return renderPlan();
    if (page === 'map') return renderMap();
    if (page === 'mail') return renderMailbox();
    if (page === 'album') return renderAlbum();
    return renderHome();
  }

  function render() {
    root.innerHTML = `<div class="app-shell"><header class="topbar"><button class="brand" data-nav="home" aria-label="回到星空小樹屋"><span class="brand-symbol">✦</span><span><strong>換個地方陪著你</strong><small>星空小樹屋</small></span></button><nav class="main-nav" aria-label="遊戲導覽"><button class="nav-link ${page === 'home' || page === 'plan' ? 'active' : ''}" data-nav="home">${icon('home')}<span>小樹屋</span></button><button class="nav-link ${page === 'map' ? 'active' : ''}" data-nav="map">${icon('map')}<span>星圖</span></button><button class="nav-link ${page === 'mail' ? 'active' : ''}" data-nav="mail">${icon('mail')}<span>信箱</span>${state.activeTrip?.status === 'pending' ? '<i class="nav-badge" aria-label="有一封新信"></i>' : ''}</button><button class="nav-link ${page === 'album' ? 'active' : ''}" data-nav="album">${icon('album')}<span>相簿</span></button></nav><div class="top-private">${icon('lock')}<span>私人空間</span></div></header><main class="main-layout"><section class="story-side"><div class="story-content"><span class="story-kicker"><i></i> A LITTLE PLACE IN THE STARS</span><h1>星空小樹屋</h1><p>把想念放進一段旅程，<br>讓回憶慢慢抵達。</p><div class="story-divider"><span>✦</span></div><div class="story-caption"><span class="tiny-label">給 ${safeText(state.pet.name)}</span><strong>無論何時回來，<br>都有一盞燈為你亮著。</strong></div></div><div class="story-signature">一個安靜、私人的紀念角落 <span>✧</span></div></section><section class="game-panel" aria-live="polite"><div class="panel-topline"><span class="panel-location"><span class="location-dot"></span> 星空小樹屋</span><span class="panel-date">${new Intl.DateTimeFormat('zh-TW', { dateStyle: 'full' }).format(new Date())}</span></div><div class="page-view">${viewContent()}</div></section></main><footer class="app-footer"><span>原型預覽</span><span class="footer-separator">·</span><span>內容只保存在此裝置</span><span class="footer-spacer"></span><span>不必趕路，回憶自有方向 <b>✦</b></span></footer><div id="toast" class="toast" role="status" aria-live="polite"></div></div>`;
  }

  function navigate(next) {
    page = next;
    if (next === 'plan' && !draft) draft = { planetId: 'new', planetName: `${state.pet.name}的星球`, description: '', scene: null, supply: null, hours: null, letter: '' };
    render();
    root.querySelector('.game-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startTrip() {
    if (state.activeTrip) {
      page = state.activeTrip.status === 'pending' ? 'mail' : 'home';
      render();
      return;
    }
    const planetId = draft?.planetId || 'new';
    if (!draft?.scene || !draft?.supply || !draft?.hours) {
      showToast('請選擇一種風景、一件補給和旅程時間。');
      return;
    }
    let planet = getPlanet(state, planetId);
    if (planetId === 'new') {
      const name = (draft.planetName || '').trim();
      if (!name) {
        showToast('替這顆星球取個名字吧。');
        root.querySelector('[data-field="planetName"]')?.focus();
        return;
      }
      planet = { id: `planet-${Date.now()}`, name, scene: draft.scene, description: draft.description.trim(), createdAt: Date.now() };
      state.planets.push(planet);
    } else if (planet) {
      planet.scene = draft.scene;
      if (draft.description.trim()) planet.description = draft.description.trim();
    }
    const arrivesAt = Date.now() + draft.hours * 60 * 60 * 1000;
    state.activeTrip = {
      id: `trip-${Date.now()}`,
      planetId: planet?.id,
      planetIndex: Math.max(0, state.planets.indexOf(planet)),
      scene: draft.scene,
      supply: draft.supply,
      hours: draft.hours,
      description: draft.description.trim(),
      letter: draft.letter.trim(),
      status: 'travelling',
      departedAt: Date.now(),
      arrivesAt,
    };
    draft = null;
    saveState(state);
    page = 'home';
    render();
    showToast('旅程已經出發。明信片抵達後會一直等你。');
  }

  function readPostcard() {
    if (state.activeTrip?.status !== 'pending') return;
    state.trips.unshift({ ...state.activeTrip, status: 'read', readAt: Date.now() });
    state.activeTrip = null;
    saveState(state);
    page = 'album';
    render();
    showToast('明信片已收進相簿。下一趟旅程可以開始了。');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '換個地方陪著你-本機備份.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('資料備份已下載到你的裝置。');
  }

  async function savePhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = source;
      await image.decode();
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      state.pet.photo = canvas.toDataURL('image/jpeg', 0.82);
      if (!saveState(state)) throw new Error('local-storage-full');
      render();
      showToast('照片已放進這台裝置的私人相簿。');
    } catch {
      showToast('照片未能保存。請試試較小的圖片。');
    }
  }

  root.addEventListener('click', (event) => {
    const navigation = event.target.closest('[data-nav]');
    if (navigation) {
      navigate(navigation.dataset.nav);
      return;
    }
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    if (action === 'plan') navigate('plan');
    if (action === 'choose') {
      if (control.dataset.kind === 'scene') draft.scene = control.dataset.value;
      if (control.dataset.kind === 'supply') draft.supply = control.dataset.value;
      if (control.dataset.kind === 'hours') draft.hours = Number(control.dataset.value);
      render();
    }
    if (action === 'read') readPostcard();
    if (action === 'preview' && isDevelopment && state.activeTrip?.status === 'travelling') {
      state.activeTrip.arrivesAt = Date.now() - 1;
      refreshTripStatus();
      showToast('原型預覽已完成這趟旅程。');
    }
    if (action === 'remove-photo') {
      state.pet.photo = '';
      saveState(state);
      render();
      showToast('已移除這台裝置中的毛孩照片。');
    }
    if (action === 'export') exportData();
    if (action === 'clear-data') {
      if (window.confirm('要刪除這台裝置中保存的照片、文字、星球與旅程嗎？這個動作無法復原。')) {
        localStorage.removeItem(STORAGE_KEY);
        state = freshState();
        page = 'home';
        render();
        showToast('本機資料已刪除。');
      }
    }
  });

  root.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    if (field === 'pet-name') {
      state.pet.name = event.target.value.slice(0, 32);
      saveState(state);
      const storyName = root.querySelector('.story-caption .tiny-label');
      if (storyName) storyName.textContent = `給 ${state.pet.name || '我的毛孩'}`;
      return;
    }
    if (draft) draft[field] = event.target.value;
  });

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-field="planetId"]')) {
      draft.planetId = event.target.value;
      if (draft.planetId === 'new' && !draft.planetName) draft.planetName = `${state.pet.name}的星球`;
      render();
    }
    if (event.target.matches('#pet-photo')) savePhoto(event.target.files?.[0]);
  });

  root.addEventListener('submit', (event) => {
    if (event.target.id !== 'trip-form') return;
    event.preventDefault();
    startTrip();
  });

  state.activeTrip && state.activeTrip.status === 'travelling' && Date.now() >= state.activeTrip.arrivesAt && (state.activeTrip.status = 'pending', state.activeTrip.arrivedAt = Date.now(), saveState(state));
  render();
  setInterval(refreshTripStatus, 1000);
}
