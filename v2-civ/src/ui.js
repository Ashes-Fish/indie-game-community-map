import * as THREE from 'three';
import { parseContact } from './data.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor({ cities, communities, base, onPick, onCity, onReplay, mobile }) {
    this.root = document.getElementById('ui');
    this.cities = cities; this.comms = communities; this.base = base; this.mobile = mobile;
    this.onPick = onPick; this.onCity = onCity;
    const logoSrc = (c) => (c.logo ? `${base}logos/${c.logo}.webp` : null);
    this.logoSrc = logoSrc;
    const icon = (c) => (c.logo ? `<img src="${logoSrc(c)}" alt="">` : `<span class="ph">存</span>`);
    this.icon = icon;
    document.body.appendChild(h('div', 'vignette'));

    // title
    const title = h('div', 'title civ-panel', `<div class="seal">游</div><div><h1>中国独立游戏社团地图</h1><div class="sub">长三角 · ${communities.length} 个社团 · ${cities.length} 座城市</div></div>`);
    this.root.appendChild(title);

    // list
    const lb = h('div', 'listbtn civ-panel', `<span>☰ 社团列表</span><span class="n">${communities.length}</span>`);
    const list = h('div', 'list civ-panel');
    for (const city of cities) {
      const cs = communities.filter((c) => c.cityId === city.id);
      if (!cs.length) continue;
      list.appendChild(h('h3', null, city.name));
      for (const c of cs) {
        const it = h('div', 'item', `${c.logo ? `<img src="${logoSrc(c)}" alt="">` : '<div class="ph">存</div>'}<div><b>${esc(c.name)}</b><small>${esc(city.name)}${c.otherCities ? ' · ' + esc(c.otherCities) : ''}${c.sizeRaw ? ' · ' + esc(c.sizeRaw) + ' 人' : ''}</small></div>`);
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
      const el = h('div', 'banner', `<div class="bar"><div class="pop" style="background:${city.color}">${cs.length}</div><div class="nm">${city.name}</div></div><div class="stripe" style="background:${city.color}"></div><div class="icons">${cs.map(icon).join('')}</div>`);
      el.querySelector('.bar').onclick = (e) => { e.stopPropagation(); onCity(city); };
      el.querySelectorAll('.icons > *').forEach((ic, i) => { ic.style.cursor = 'pointer'; ic.onclick = (e) => { e.stopPropagation(); onPick(cs[i], true); }; });
      this.root.appendChild(el);
      return { el, city, pos: new THREE.Vector3(city.x, city.y + 5.2, city.z) };
    });
    // district tags
    this.tags = communities.map((c) => {
      const el = h('div', 'dtag', `${icon(c)}<span>${esc(c.short || c.name)}</span>`);
      el.onclick = (e) => { e.stopPropagation(); onPick(c, true); };
      this.root.appendChild(el);
      return { el, c, pos: new THREE.Vector3(c.x, c.y + 4.4, c.z), shown: false };
    });
    this.labels = [];

    this.tip = h('div', 'tip civ-panel');
    this.root.appendChild(this.tip);

    // panel
    this.panel = h('div', 'panel civ-panel');
    this.root.appendChild(this.panel);

    const rp = h('div', 'btn civ-panel replay', '↻ 重播建城');
    rp.onclick = onReplay;
    this.root.appendChild(rp);
    this.root.appendChild(h('div', 'credit', '高程：AWS Terrain Tiles（SRTM 等）· 水系：Natural Earth · 社团数据：社团自填'));
    this.help = h('div', 'help civ-panel', mobile ? '单指拖动 · 双指缩放 · 点社团看详情' : '拖拽平移 · 滚轮缩放 · 点击社团查看详情');
    this.root.appendChild(this.help);
    setTimeout(() => { this.help.style.opacity = '0'; }, 9000);
    this.toasts = h('div', 'toasts');
    this.root.appendChild(this.toasts);
    this._v = new THREE.Vector3();
  }

  addLabel(text, x, y, z, cls = '') {
    const el = h('div', 'maplabel ' + cls, text);
    this.root.insertBefore(el, this.root.firstChild);
    this.labels.push({ el, pos: new THREE.Vector3(x, y, z), cls });
  }

  project(p, cam, w, hh) {
    const v = this._v.copy(p).project(cam);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hh, ok: v.z < 1 && v.x > -1.3 && v.x < 1.3 && v.y > -1.3 && v.y < 1.3 };
  }

  update(cam, dist, buildState) {
    const w = innerWidth, hh = innerHeight;
    const sc = THREE.MathUtils.clamp(1.25 - dist / 520, 0.78, 1.12) * (this.mobile ? 0.92 : 1);
    for (const b of this.banners) {
      const p = this.project(b.pos, cam, w, hh);
      b.el.style.display = p.ok ? '' : 'none';
      if (p.ok) b.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%) scale(${sc})`;
    }
    const showTags = dist < 150;
    for (const t of this.tags) {
      const built = buildState ? buildState(t.c) : true;
      const p = this.project(t.pos, cam, w, hh);
      const vis = showTags && p.ok && built;
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
    this.tip.innerHTML = c.isCity ? `<b>${esc(c.name)}</b> · 点击查看全城` : `<b>${esc(c.name)}</b> · ${esc(city.name)} · 点击查看`;
    this.tip.style.display = 'block';
    this.tip.style.transform = `translate(${x + 16}px,${y + 14}px)`;
  }

  toast(c) {
    const city = this.cities.find((k) => k.id === c.cityId);
    const t = h('div', 'toast civ-panel', `${c.logo ? `<img src="${this.logoSrc(c)}">` : '<div class="ph">存</div>'}<div><small>区域建成</small><b>${esc(c.short || c.name)}</b> · ${esc(city.name)}</div>`);
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
    const metaBits = [city.name + (c.otherCities ? ' · ' + c.otherCities : ''), c.founded ? `成立 ${esc(c.foundedRaw || c.founded)}` : '', c.sizeRaw ? `${esc(c.sizeRaw)} 人` : ''].filter(Boolean);
    this.panel.style.setProperty('--civ', city.color);
    this.panel.innerHTML = `
      <div class="hd">${c.logo ? `<img class="logo" src="${this.logoSrc(c)}" alt="">` : '<div class="logo ph">存</div>'}
        <div><h2>${esc(c.name)}</h2><div class="meta">${metaBits.join(' · ')}</div></div>
        <div class="x" title="关闭">×</div></div>
      <div class="bd">
        <p class="intro">${esc(c.intro || '这个社团还没写简介——直接加负责人聊聊吧。')}</p>
        <div class="sec">联络</div>
        ${rows.map(([k, v, copy]) => `<div class="row"><div class="k">${k}</div><div class="v">${v}</div>${copy ? `<button class="copy" data-v="${esc(copy)}">复制</button>` : ''}</div>`).join('')}
        <div class="hint">主理人欢迎同好加好友，添加时备注「社团地图」更容易通过。</div>
      </div>`;
    this.panel.querySelector('.x').onclick = () => this.closePanel();
    this.panel.querySelectorAll('.copy').forEach((b) => {
      b.onclick = async () => {
        const v = b.dataset.v;
        try { await navigator.clipboard.writeText(v); } catch (e) {
          const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        b.textContent = '已复制'; b.classList.add('ok');
        setTimeout(() => { b.textContent = '复制'; b.classList.remove('ok'); }, 1600);
      };
    });
    requestAnimationFrame(() => this.panel.classList.add('open'));
    this.openId = c.key;
  }
  closePanel() { this.panel.classList.remove('open'); this.openId = null; this.onClose && this.onClose(); }
}
