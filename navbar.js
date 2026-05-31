/**
 * navbar.js — Injects shared navbar into all pages
 */
(function() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.innerHTML = `
    <div class="nb-logo" onclick="goPage('lobby')">3006</div>
    <div class="nb-r">
      <div class="nb-ava" id="navAva" onclick="goPage('settings')" title="Settings">?</div>
      <button class="nb-burger" id="burgerBtn" onclick="toggleBurger()">☰</button>
    </div>
  `;

  const menu = document.getElementById('burgerMenu');
  if (!menu) return;
  menu.innerHTML = `
    <button class="bm-item" onclick="goPage('lobby')"><i class="ti ti-home-2 bmi-icon-ti lobby"></i> Lobby</button>
    <button class="bm-item" onclick="goPage('library')"><i class="ti ti-books bmi-icon-ti library"></i> Library</button>
    <button class="bm-item" onclick="goPage('community')"><i class="ti ti-message-circle bmi-icon-ti comm"></i> Community</button>
    <div class="bmenu-sep"></div>
    <button class="bm-item" onclick="goPage('settings')"><i class="ti ti-settings-2 bmi-icon-ti sets"></i> Settings</button>
    <button class="bm-item" id="bm-admin" style="display:none" onclick="goPage('admin')"><i class="ti ti-shield bmi-icon-ti admin"></i> Admin Panel</button>
    <div class="bmenu-sep"></div>
    <button class="bm-item bmenu-danger" onclick="API.logout()"><i class="ti ti-logout bmi-icon-ti logout"></i> ออกจากระบบ</button>
  `;
})();
