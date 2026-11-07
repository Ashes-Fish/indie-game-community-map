// 界面图标：24×24 金色线描，同线宽，颜色随 currentColor
const P = {
  list: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><path class="f" d="M5 4.8 6.7 6.5 5 8.2 3.3 6.5zM5 10.3 6.7 12 5 13.7 3.3 12zM5 15.8 6.7 17.5 5 19.2 3.3 17.5z"/>',
  replay: '<path d="M4.6 13.2A7.6 7.6 0 1 0 6.9 6.4"/><path d="M4.4 3.6v4.6H9"/><path class="f" d="M12 10.4 13.6 12 12 13.6 10.4 12z"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.2"/><path d="M15.5 8.5V5.7a1.2 1.2 0 0 0-1.2-1.2H5.7a1.2 1.2 0 0 0-1.2 1.2v8.6a1.2 1.2 0 0 0 1.2 1.2h2.8"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  mountain: '<path d="M2.5 19.5 9.2 8l4.1 6.6 2.4-3.4 5.8 8.3z"/><path d="M6.9 12l2.3 1.3 1.6-1.2"/><circle cx="17.6" cy="5.6" r="1.9"/>',
  city: '<path d="M2.5 20.5h19M4.5 20.5v-7h15v7M7 13.5v-3h10v3M4.8 10.5c2.6-.5 5.1-2.1 7.2-4.6 2.1 2.5 4.6 4.1 7.2 4.6M12 5.9V3.6"/><path d="M10 20.5v-3a2 2 0 0 1 4 0v3"/>',
  pop: '<circle cx="12" cy="8" r="3.4"/><path d="M5.3 20c.6-4 3.3-6.3 6.7-6.3s6.1 2.3 6.7 6.3"/>',
  drag: '<path d="M12 3.5v17M3.5 12h17M9.5 6 12 3.5 14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5 3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>',
  tap: '<path d="M9.5 13V5.8a1.6 1.6 0 0 1 3.2 0v5.7l4.6.9a2 2 0 0 1 1.6 2.3l-.8 4.6a1.6 1.6 0 0 1-1.6 1.3h-5.6a1.8 1.8 0 0 1-1.4-.7L6 16.1a1.6 1.6 0 0 1 2.4-2.1z"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

// 描金九宫格边框（border-image 用）：外粗线 + 内细线，四角内切小台阶 + 菱形
const gold = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8e3a3"/><stop offset=".45" stop-color="#d4ab55"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient>';
const corners = (d, c) => [0, 90, 180, 270].map((a) => `<path transform="rotate(${a} ${c} ${c})" d="${d}"/>`).join('');
const url = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// 40×40，切片 10（= 边框宽，装饰都在这 10px 内）
export const FRAME = url(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><defs>${gold}</defs>
<rect x=".75" y=".75" width="38.5" height="38.5" rx="2" fill="none" stroke="#06101f" stroke-width="1.5"/>
<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="1.5" fill="none" stroke="url(#g)" stroke-width="1.3"/>
<g fill="none" stroke="#c99f4c" stroke-width=".8" opacity=".9">${corners('M20 5H9.5V9.5H5V20', 20)}</g>
<g fill="#e6c477" stroke="#06101f" stroke-width=".5">${corners('M5.6 3 8.2 5.6 5.6 8.2 3 5.6z', 20)}</g></svg>`);

// 24×24，切片 5：横幅、小标签用
export const FRAME_S = url(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs>${gold}</defs>
<rect x=".6" y=".6" width="22.8" height="22.8" rx="1.5" fill="none" stroke="#06101f" stroke-width="1.2"/>
<rect x="1.3" y="1.3" width="21.4" height="21.4" rx="1" fill="none" stroke="url(#g)" stroke-width="1.1"/>
<g fill="none" stroke="#c99f4c" stroke-width=".6" opacity=".75">${corners('M12 3.6H3.6V12', 12)}</g></svg>`);
