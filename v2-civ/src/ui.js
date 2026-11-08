import * as THREE from 'three';
import { parseContact } from './data.js';
import { icon, FRAME, FRAME_S } from './icons.js';
import { modelLabel, FEATURES } from './models.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const BANNER_ICONS = 6; // the rest show as "+N"; the full list is in the 社团列表 panel
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor({ cities, communities, sites, base, onPick, onSite, onCity, onReplay, mobile }) {
    this.root = document.getElementById('ui');
    this.root.style.setProperty('--frame', FRAME);
    this.root.style.setProperty('--frame-s', FRAME_S);
    this.cities = cities; this.comms = communities; this.base = base; this.mobile = mobile;
    this.onPick = onPick; this.onSite = onSite; this.onCity = onCity;
    const logoSrc = (c) => (c.logo ? `${base}logos/${c.logo}.webp` : null);
    this.logoSrc = logoSrc;
    const logo = (c) => (c.logo ? `<img src="${logoSrc(c)}" alt="">` : `<span class="ph">${esc(c.glyph)}</span>`);
    this.icon = logo;
    document.body.appendChild(h('div', 'vignette'));

    // title
    const title = h('div', 'title civ-panel', `<div class="seal">游</div><div><h1>中国独立游戏社团地图</h1><div class="sub">长三角 · ${communities.length} 个社团 · ${cities.length} 座城市</div></div>`);
    this.root.appendChild(title);

    // list
    const lb = h('div', 'listbtn civ-panel', `${icon('list')}<span>社团列表</span><span class="n">${communities.length}</span>`);
    const list = h('div', 'list civ-panel');
    for (const city of cities) {
      const cs = communities.filter((c) => c.cityId === city.id);
      if (!cs.length) continue;
      list.appendChild(h('h3', null, `<i style="--c:${city.color}"></i><span>${city.name}</span>`));
      for (const c of cs) {
        const it = h('div', 'item', `${logo(c)}<div><b>${esc(c.name)}</b><small>${esc(city.name)}${c.otherCities ? ' · ' + esc(c.otherCities) : ''}${c.sizeRaw ? ` · ${icon('pop')}${esc(c.sizeRaw)}` : ''}</small></div>`);
        it.onclick = () => { list.classList.remove('open'); onPick(c, true); };
        list.appendChild(it);
      }
    }
    lb.onclick = () => list.classList.toggle('open');
    this.root.append(lb, list);
    this.list = list;

    // banners
    this.banners = cities.map((city) => {
      const cs = communities.filter((c) => c.cityId === city.id || (c.otherCities || '').includes(city.name));
      const el = h('div', 'banner', `<div class="bar"><div class="pop">${cs.length}</div><div class="nm">${city.name}</div>${city.tier && city.radius !== 2 ? `<div class="tier">${city.tier.name}</div>` : ''}</div><div class="icons">${cs.slice(0, BANNER_ICONS).map(logo).join('')}${cs.length > BANNER_ICONS ? `<span class="more">+${cs.length - BANNER_ICONS}</span>` : ''}</div>`);
      el.style.setProperty('--c', city.color);
      el.querySelector('.bar').onclick = (e) => { e.stopPropagation(); onCity(city); };
      el.querySelectorAll('.icons > :not(.more)').forEach((ic, i) => { ic.style.cursor = 'pointer'; ic.onclick = (e) => { e.stopPropagation(); onPick(cs[i], true); }; });
      this.root.appendChild(el);
      return { el, city, pos: new THREE.Vector3(city.x, city.y + 5.2, city.z) };
    });
    // district tags: one per hex; a cluster hex shows its lead community plus a count
    this.tags = sites.map((s) => {
      const c = s.members[0], n = s.members.length;
      const el = h('div', 'dtag' + (n > 1 ? ' cluster' : ''), `${logo(c)}<span class="nm">${esc(n > 1 ? `${c.short || c.name} 等` : c.short || c.name)}</span>${n > 1 ? `<b class="cnt">${n}</b>` : ''}`);
      el.onclick = (e) => { e.stopPropagation(); onSite(s, true); };
      this.root.appendChild(el);
      return { el, c, s, pos: new THREE.Vector3(s.x, s.y + 4.4, s.z), shown: false };
    });
    this.labels = [];
    const perCity = {};
    for (const s of sites) perCity[s.cityId] = (perCity[s.cityId] || 0) + 1;
    this.dense = new Set(Object.keys(perCity).filter((id) => perCity[id] > 8));

    this.tip = h('div', 'tip civ-panel');
    this.root.appendChild(this.tip);

    // panel
    this.panel = h('div', 'panel civ-panel');
    this.root.appendChild(this.panel);

    const rp = h('div', 'btn civ-panel replay', `${icon('replay')}<span>重播建城</span>`);
    rp.onclick = onReplay;
    this.root.appendChild(rp);
    this.root.appendChild(h('div', 'credit', '高程：AWS Terrain Tiles（SRTM 等）· 水系：Natural Earth · 社团数据：社团自填'));
    this.help = h('div', 'help civ-panel', (mobile ? [['drag', '单指拖动'], ['zoom', '双指缩放'], ['tap', '点社团看详情']] : [['drag', '拖拽平移'], ['zoom', '滚轮缩放'], ['tap', '点击社团查看详情']])
      .map(([k, t]) => `<span>${icon(k)}${t}</span>`).join(''));
    this.root.appendChild(this.help);
    setTimeout(() => { this.help.style.opacity = '0'; }, 9000);
    this.toasts = h('div', 'toasts');
    this.root.appendChild(this.toasts);
    this._v = new THREE.Vector3();
  }

  addLabel(text, x, y, z, cls = '') {
    const el = h('div', 'maplabel ' + cls, cls.includes('wonder') ? `${icon('mountain')}<span>${text.replace(/^⛰\s*/, '')}</span>` : text);
    this.root.insertBefore(el, this.root.firstChild);
    this.labels.push({ el, pos: new THREE.Vector3(x, y, z), cls });
  }

  project(p, cam, w, hh) {
    const v = this._v.copy(p).project(cam);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hh, ok: v.z < 1 && v.x > -1.3 && v.x < 1.3 && v.y > -1.3 && v.y < 1.3 };
  }

  update(cam, dist, buildState) {
    const w = innerWidth, hh = innerHeight;
    const sc = THREE.MathUtils.clamp(1.25 - dist / 520, 0.86, 1.12) * (this.mobile ? 0.92 : 1);
    for (const b of this.banners) {
      const p = this.project(b.pos, cam, w, hh);
      b.el.style.display = p.ok ? '' : 'none';
      if (p.ok) b.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%) scale(${sc})`;
    }
    const showTags = dist < 150;
    // dense cities reveal their tags only when zoomed further in, so names don't pile up
    const near = (t) => dist < (this.dense.has(t.s.cityId) ? 70 : 150);
    for (const t of this.tags) {
      const built = buildState ? t.s.members.some(buildState) : true;
      const p = this.project(t.pos, cam, w, hh);
      const vis = showTags && near(t) && p.ok && built;
      t.el.style.display = vis ? '' : 'none';
      if (vis) t.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%) scale(${THREE.MathUtils.clamp(1.3 - dist / 220, 0.8, 1.15)})`;
    }
    for (const l of this.labels) {
      const p = this.project(l.pos, cam, w, hh);
      const fade = l.cls.includes('wonder') ? 1 : THREE.MathUtils.clamp((dist - 60) / 80, 0, 1);
      l.el.style.display = p.ok && fade > 0.02 ? '' : 'none';
      if (p.ok) { l.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; l.el.style.opacity = fade; }
    }
  }

  showTip(c, x, y) {
    if (!c) { this.tip.style.display = 'none'; return; }
    const city = this.cities.find((k) => k.id === c.cityId);
    if (c.isCity) this.tip.innerHTML = `<b>${esc(c.name)}</b>${c.tier ? ' · ' + c.tier.name : ''} · 点击查看全城`;
    else if (c.members.length > 1) this.tip.innerHTML = `<b>${c.members.length} 个社团</b> · ${esc(city.name)} · 点击查看`;
    else this.tip.innerHTML = `<b>${esc(c.members[0].name)}</b> · ${esc(city.name)} · 点击查看`;
    this.tip.style.display = 'block';
    this.tip.style.transform = `translate(${x + 16}px,${y + 14}px)`;
  }

  toast(c) {
    const city = this.cities.find((k) => k.id === c.cityId);
    const t = h('div', 'toast civ-panel', `${this.icon(c)}<div><small>区域建成</small><b>${esc(c.short || c.name)}</b><span class="cn"> · ${esc(city.name)}</span></div>`);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > (this.mobile ? 2 : 4)) this.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 520); }, 3200);
  }

  openPanel(c) {
    const city = this.cities.find((k) => k.id === c.cityId);
    const contacts = parseContact(c.contact);
    const rows = [];
    if (c.leader) rows.push(['负责人', esc(c.leader)]);
    for (const ct of contacts) rows.push([ct.label === 'QQ' ? 'QQ' : '微信', esc(ct.value), ct.value]);
    const qq = (c.qqGroup || '').split('\n').filter(Boolean);
    for (const q of qq) { const m = q.match(/(\d{6,})/); rows.push(['QQ 群', esc(q.replace(/^QQ群[:：]/, '')), m ? m[1] : null]); }
    if (c.wechatGroup) rows.push(['微信群', esc(c.wechatGroup)]);
    const site = (c.website || '').split('\n')[0];
    if (site && site !== '暂无') { const url = /^https?:/.test(site) ? site : 'https://' + site.replace(/^.*?：/, ''); rows.push(['官网', `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(site)}</a>`]); }
    if (c.address) rows.push(['地址', esc(c.address)]);
    const metaBits = [icon('city') + city.name + (c.otherCities ? ' · ' + esc(c.otherCities) : ''), c.founded ? `成立 ${esc(c.foundedRaw || c.founded)}` : '', c.sizeRaw ? `${icon('pop')}${esc(c.sizeRaw)} 人` : ''].filter(Boolean);
    this.panel.style.setProperty('--civ', city.color);
    this.panel.innerHTML = `
      <div class="hd">${c.logo ? `<img class="logo" src="${this.logoSrc(c)}" alt="">` : `<div class="logo ph">${esc(c.glyph)}</div>`}
        <div><h2>${esc(c.name)}</h2><div class="meta">${metaBits.map((b) => `<span>${b}</span>`).join('')}</div></div>
        <div class="x" title="关闭">${icon('close')}</div></div>
      <div class="bd">
        <p class="intro">${esc(c.intro || '这个社团还没写简介——直接加负责人聊聊吧。')}</p>
        <div class="sec">联络</div>
        ${rows.map(([k, v, copy]) => `<div class="row"><div class="k">${k}</div><div class="v">${v}</div>${copy ? `<button class="copy" data-v="${esc(copy)}">${icon('copy')}<span>复制</span></button>` : ''}</div>`).join('')}
        <div class="hint">主理人欢迎同好加好友，添加时备注「社团地图」更容易通过。</div>
        <div class="sec">据点外观</div>
        <div class="row"><div class="k">造型</div><div class="v">${esc(modelLabel(c.model))}</div></div>
        <button class="custom-model" ${FEATURES.customModels ? '' : 'disabled'} title="上传 .glb 模型作为据点外观">自定义据点模型<span>${FEATURES.customModels ? '' : '敬请期待'}</span></button>
      </div>`;
    this.panel.querySelector('.x').onclick = () => this.closePanel();
    this.panel.querySelectorAll('.copy').forEach((b) => {
      b.onclick = async () => {
        const v = b.dataset.v;
        try { await navigator.clipboard.writeText(v); } catch (e) {
          const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        b.innerHTML = `${icon('check')}<span>已复制</span>`; b.classList.add('ok');
        setTimeout(() => { b.innerHTML = `${icon('copy')}<span>复制</span>`; b.classList.remove('ok'); }, 1600);
      };
    });
    requestAnimationFrame(() => this.panel.classList.add('open'));
    this.openId = c.key;
  }

  // a hex shared by several communities: list them, each opens its own panel
  openCluster(s) {
    const city = this.cities.find((k) => k.id === s.cityId);
    this.panel.style.setProperty('--civ', city.color);
    this.panel.innerHTML = `
      <div class="hd"><div class="logo ph">${s.members.length}</div>
        <div><h2>${esc(city.name)} · 聚落</h2><div class="meta">这一格聚集了 ${s.members.length} 个社团</div></div>
        <div class="x" title="关闭">×</div></div>
      <div class="bd cluster-list">${s.members.map((c, i) => `<div class="item" data-i="${i}">${c.logo ? `<img src="${this.logoSrc(c)}" alt="">` : `<div class="ph">${esc(c.glyph)}</div>`}<div><b>${esc(c.name)}</b><small>${esc(c.intro || '')}</small></div></div>`).join('')}</div>`;
    this.panel.querySelector('.x').onclick = () => this.closePanel();
    this.panel.querySelectorAll('.cluster-list .item').forEach((el) => { el.onclick = () => this.openPanel(s.members[+el.dataset.i]); });
    requestAnimationFrame(() => this.panel.classList.add('open'));
    this.openId = 'site:' + s.hex.join(',');
  }
  closePanel() { this.panel.classList.remove('open'); this.openId = null; this.onClose && this.onClose(); }
}
