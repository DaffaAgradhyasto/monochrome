// js/connect-prompt.js
// Menampilkan overlay 'Connect with Account' saat pertama kali masuk, hilang setelah login

import { authManager } from './accounts/auth.js';

const STORAGE_KEY = 'aether_user_logged_in';

export function initConnectPrompt(discordSvg, googleSvg, githubSvg, spotifySvg) {
  // Jika sudah login sebelumnya (dari localStorage flag), tunggu authManager
  // authManager.init() sudah async, jadi kita listen lewat onAuthStateChanged

  // Cek apakah overlay sudah ada di DOM
  let overlay = document.getElementById('connect-prompt-overlay');
  if (!overlay) {
    overlay = createOverlay(discordSvg, googleSvg, githubSvg, spotifySvg);
    document.body.appendChild(overlay);
  }

  // Cek auth state saat ini
  // authManager.user akan bernilai setelah init() selesai
  // Kita gunakan onAuthStateChanged untuk deteksi
  authManager.onAuthStateChanged((user) => {
    if (user) {
      // User sudah login - sembunyikan overlay dan simpan flag
      localStorage.setItem(STORAGE_KEY, '1');
      hidePrompt(overlay);
    } else {
      // User belum login - tampilkan overlay
      showPrompt(overlay);
    }
  });

  // Fallback: jika authManager sudah punya state (init sudah selesai sebelum listener dipasang)
  // onAuthStateChanged sudah handle ini, tapi kita set initial display
  // Sembunyikan dulu secara default (akan ditampilkan oleh listener jika perlu)
  overlay.style.display = 'none';
}

function showPrompt(overlay) {
  overlay.style.display = 'flex';
  // Prevent scroll di belakang overlay
  document.body.style.overflow = 'hidden';
}

function hidePrompt(overlay) {
  overlay.style.animation = 'connectPromptFadeOut 0.4s ease forwards';
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.style.animation = '';
    document.body.style.overflow = '';
  }, 400);
}

function createOverlay(discordSvg, googleSvg, githubSvg, spotifySvg) {
  const overlay = document.createElement('div');
  overlay.id = 'connect-prompt-overlay';
  overlay.innerHTML = `
    <div class="connect-prompt-backdrop"></div>
    <div class="connect-prompt-card">
      <div class="connect-prompt-logo">
        <img src="/assets/logo.svg" alt="Aether" width="48" height="48" />
        <h1>Aether</h1>
      </div>
      <h2 class="connect-prompt-title">Selamat Datang di Aether</h2>
      <p class="connect-prompt-subtitle">
        Hubungkan akun kamu untuk menyinkronkan library musik lintas perangkat.
      </p>

      <div class="connect-prompt-divider">
        <span>Connect with</span>
      </div>

      <div class="connect-prompt-oauth-btns">
        <button id="cp-discord-btn" class="cp-oauth-btn cp-discord" title="Connect with Discord">
          ${discordSvg}
        </button>
        <button id="cp-google-btn" class="cp-oauth-btn cp-google" title="Connect with Google">
          ${googleSvg}
        </button>
        <button id="cp-github-btn" class="cp-oauth-btn cp-github" title="Connect with GitHub">
          ${githubSvg}
        </button>
        <button id="cp-spotify-btn" class="cp-oauth-btn cp-spotify" title="Connect with Spotify">
          ${spotifySvg}
        </button>
      </div>

      <button id="cp-email-btn" class="connect-prompt-email-btn">
        Hubungkan dengan Email
      </button>

      <p class="connect-prompt-note">
        Kami hanya menyimpan data musik dan ID acak. Data kamu sepenuhnya anonim.
      </p>
    </div>
  `;

  // Pasang event listeners untuk tombol
  setTimeout(() => {
    overlay.querySelector('#cp-discord-btn')?.addEventListener('click', () => authManager.signInWithDiscord());
    overlay.querySelector('#cp-google-btn')?.addEventListener('click', () => authManager.signInWithGoogle());
    overlay.querySelector('#cp-github-btn')?.addEventListener('click', () => authManager.signInWithGitHub());
    overlay.querySelector('#cp-spotify-btn')?.addEventListener('click', () => authManager.signInWithSpotify());
    overlay.querySelector('#cp-email-btn')?.addEventListener('click', () => {
      document.getElementById('email-auth-modal')?.classList.add('active');
    });
  }, 0);

  return overlay;
}
