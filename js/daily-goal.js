import { showNotification } from './downloads.js';

const STORAGE_KEY = 'aether-daily-goal';

const STYLE_ID = 'dg-styles';

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    .dg-ring-container {
      position: relative;
      width: 36px;
      height: 36px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .dg-ring-svg {
      transform: rotate(-90deg);
      width: 36px;
      height: 36px;
    }

    .dg-ring-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.15);
      stroke-width: 3;
    }

    .dg-ring-progress {
      fill: none;
      stroke: #fff;
      stroke-width: 3;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease;
    }

    .dg-ring-complete .dg-ring-progress {
      stroke: #4ade80;
    }

    .dg-ring-container.dg-pulse {
      animation: dg-pulse-anim 0.6s ease-in-out 3;
    }

    @keyframes dg-pulse-anim {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.3); }
      100% { transform: scale(1); }
    }

    .dg-ring-label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1;
      pointer-events: none;
    }

    .dg-ring-complete .dg-ring-label {
      color: #4ade80;
    }

    .dg-settings {
      padding: 16px;
      color: #fff;
    }

    .dg-settings h3 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
    }

    .dg-settings-label {
      font-size: 13px;
      opacity: 0.7;
      margin-bottom: 8px;
    }

    .dg-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .dg-preset-btn {
      padding: 6px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: transparent;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .dg-preset-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .dg-preset-btn.dg-active {
      background: #fff;
      color: #000;
      border-color: #fff;
    }

    .dg-slider-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dg-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.2);
      outline: none;
    }

    .dg-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
    }

    .dg-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
      border: none;
    }

    .dg-slider-value {
      font-size: 14px;
      font-weight: 600;
      min-width: 40px;
      text-align: right;
    }

    .dg-stats {
      padding: 16px;
      color: #fff;
    }

    .dg-stats h3 {
      margin: 0 0 16px;
      font-size: 15px;
      font-weight: 600;
    }

    .dg-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }

    .dg-stat-card {
      text-align: center;
      padding: 14px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
    }

    .dg-stat-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .dg-stat-label {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dg-today-bar {
      margin-top: 20px;
    }

    .dg-today-bar-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .dg-today-bar-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.15);
      overflow: hidden;
    }

    .dg-today-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: #fff;
      transition: width 0.6s ease;
    }

    .dg-today-bar-complete .dg-today-bar-fill {
      background: #4ade80;
    }

    .dg-streak-label {
      margin-top: 16px;
      text-align: center;
      font-size: 13px;
      opacity: 0.7;
    }

    .dg-streak-label strong {
      opacity: 1;
    }
  `;
    document.head.appendChild(style);
}

export class DailyGoal {
    constructor(player, audioPlayer) {
        this._player = player;
        this._audioPlayer = audioPlayer;
        this._goalMinutes = 30;
        this._todaySeconds = 0;
        this._currentStreak = 0;
        this._longestStreak = 0;
        this._totalDaysMet = 0;
        this._lastDateTracked = null;
        this._goalReachedToday = false;
        this._ringEl = null;
        this._settingsContainer = null;
        this._statsContainer = null;
        this._load();
        injectStyles();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.goalMinutes === 'number') this._goalMinutes = data.goalMinutes;
            if (typeof data.currentStreak === 'number') this._currentStreak = data.currentStreak;
            if (typeof data.longestStreak === 'number') this._longestStreak = data.longestStreak;
            if (typeof data.totalDaysMet === 'number') this._totalDaysMet = data.totalDaysMet;
            if (data.dailyData && typeof data.dailyData === 'object') {
                this._dailyData = data.dailyData;
            } else {
                this._dailyData = {};
            }
            const today = this._today();
            if (this._dailyData[today]) {
                this._todaySeconds = this._dailyData[today].seconds || 0;
                this._goalReachedToday = this._todaySeconds >= this._goalMinutes * 60;
            }
            this._lastDateTracked = today;
            this._checkDayRollover();
        } catch (_) {
            this._dailyData = {};
        }
    }

    _save() {
        const payload = {
            goalMinutes: this._goalMinutes,
            dailyData: this._dailyData,
            currentStreak: this._currentStreak,
            longestStreak: this._longestStreak,
            totalDaysMet: this._totalDaysMet,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    _today() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    _checkDayRollover() {
        const today = this._today();
        if (this._lastDateTracked === today) return;

        const yesterday = this._yesterdayDate();

        if (this._lastDateTracked && this._lastDateTracked !== yesterday) {
            const hadMetYesterday =
                this._dailyData[yesterday] && this._dailyData[yesterday].seconds >= this._goalMinutes * 60;
            if (!hadMetYesterday) {
                this._currentStreak = 0;
            }
        }

        this._todaySeconds = 0;
        this._goalReachedToday = false;
        this._lastDateTracked = today;

        if (!this._dailyData[today]) {
            this._dailyData[today] = { seconds: 0 };
        }

        this._save();
    }

    _yesterdayDate() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    recordListening(seconds) {
        if (!seconds || seconds <= 0) return;
        this._checkDayRollover();

        const today = this._today();
        this._todaySeconds += seconds;
        this._dailyData[today] = { seconds: this._todaySeconds };

        if (!this._goalReachedToday && this._todaySeconds >= this._goalMinutes * 60) {
            this._goalReachedToday = true;
            this._currentStreak += 1;
            this._totalDaysMet += 1;
            if (this._currentStreak > this._longestStreak) {
                this._longestStreak = this._currentStreak;
            }
            this._celebrateGoalReached();
        }

        this._save();
        this._updateRing();
        this._updateSettingsUI();
        this._updateStatsUI();
    }

    _celebrateGoalReached() {
        const msg = `Daily goal reached! ${this._goalMinutes} min streak: ${this._currentStreak} day${this._currentStreak !== 1 ? 's' : ''}`;
        showNotification(msg);

        if (this._ringEl) {
            this._ringEl.classList.add('dg-pulse');
            this._ringEl.addEventListener(
                'animationend',
                () => {
                    this._ringEl.classList.remove('dg-pulse');
                },
                { once: true }
            );
        }
    }

    setGoal(minutes) {
        const valid = [15, 30, 45, 60, 90, 120];
        if (!valid.includes(minutes)) return;
        this._goalMinutes = minutes;
        this._goalReachedToday = this._todaySeconds >= this._goalMinutes * 60;
        this._save();
        this._updateRing();
        this._updateSettingsUI();
        this._updateStatsUI();
    }

    getProgress() {
        const goalSec = this._goalMinutes * 60;
        return Math.min(this._todaySeconds / goalSec, 1);
    }

    renderProgressBar() {
        if (this._ringEl) return this._ringEl;

        const container = document.createElement('div');
        container.className = 'dg-ring-container';

        const radius = 14;
        const circumference = 2 * Math.PI * radius;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'dg-ring-svg');
        svg.setAttribute('viewBox', '0 0 36 36');

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('class', 'dg-ring-bg');
        bg.setAttribute('cx', '18');
        bg.setAttribute('cy', '18');
        bg.setAttribute('r', String(radius));

        const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progress.setAttribute('class', 'dg-ring-progress');
        progress.setAttribute('cx', '18');
        progress.setAttribute('cy', '18');
        progress.setAttribute('r', String(radius));
        progress.style.strokeDasharray = String(circumference);
        progress.style.strokeDashoffset = String(circumference);

        svg.appendChild(bg);
        svg.appendChild(progress);
        container.appendChild(svg);

        const label = document.createElement('span');
        label.className = 'dg-ring-label';
        label.textContent = `${this._goalMinutes}m`;
        container.appendChild(label);

        container.addEventListener('click', () => {
            if (this._settingsContainer) {
                this._settingsContainer.style.display =
                    this._settingsContainer.style.display === 'none' ? 'block' : 'none';
            }
        });

        this._ringEl = container;
        this._ringProgress = progress;
        this._ringCircumference = circumference;
        this._updateRing();

        return container;
    }

    _updateRing() {
        if (!this._ringProgress) return;
        const progress = this.getProgress();
        const offset = this._ringCircumference * (1 - progress);
        this._ringProgress.style.strokeDashoffset = String(offset);

        if (progress >= 1) {
            this._ringEl.classList.add('dg-ring-complete');
        } else {
            this._ringEl.classList.remove('dg-ring-complete');
        }
    }

    renderSettingsUI(container) {
        this._settingsContainer = container;
        container.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'dg-settings';

        const heading = document.createElement('h3');
        heading.textContent = 'Daily Listening Goal';
        wrap.appendChild(heading);

        const label1 = document.createElement('div');
        label1.className = 'dg-settings-label';
        label1.textContent = 'Quick select';
        wrap.appendChild(label1);

        const presets = document.createElement('div');
        presets.className = 'dg-presets';

        const options = [15, 30, 45, 60, 90, 120];
        options.forEach((min) => {
            const btn = document.createElement('button');
            btn.className = 'dg-preset-btn' + (min === this._goalMinutes ? ' dg-active' : '');
            btn.textContent = min >= 60 ? `${min / 60}h` : `${min}m`;
            btn.addEventListener('click', () => {
                this.setGoal(min);
            });
            presets.appendChild(btn);
        });

        wrap.appendChild(presets);

        const label2 = document.createElement('div');
        label2.className = 'dg-settings-label';
        label2.textContent = 'Or use slider';
        wrap.appendChild(label2);

        const sliderRow = document.createElement('div');
        sliderRow.className = 'dg-slider-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'dg-slider';
        slider.min = '5';
        slider.max = '180';
        slider.step = '5';
        slider.value = String(this._goalMinutes);

        const sliderVal = document.createElement('span');
        sliderVal.className = 'dg-slider-value';
        sliderVal.textContent =
            this._goalMinutes >= 60
                ? `${(this._goalMinutes / 60).toFixed(this._goalMinutes % 60 === 0 ? 0 : 1)}h`
                : `${this._goalMinutes}m`;

        slider.addEventListener('input', () => {
            const v = parseInt(slider.value, 10);
            sliderVal.textContent = v >= 60 ? `${(v / 60).toFixed(v % 60 === 0 ? 0 : 1)}h` : `${v}m`;
        });

        slider.addEventListener('change', () => {
            const v = parseInt(slider.value, 10);
            this.setGoal(v);
        });

        sliderRow.appendChild(slider);
        sliderRow.appendChild(sliderVal);
        wrap.appendChild(sliderRow);

        container.appendChild(wrap);
        this._settingsWrap = wrap;
    }

    _updateSettingsUI() {
        if (!this._settingsWrap) return;
        const btns = this._settingsWrap.querySelectorAll('.dg-preset-btn');
        btns.forEach((btn) => {
            const text = btn.textContent;
            let val;
            if (text.endsWith('h')) {
                val = parseFloat(text) * 60;
            } else {
                val = parseInt(text, 10);
            }
            btn.classList.toggle('dg-active', val === this._goalMinutes);
        });
    }

    renderStatsUI(container) {
        this._statsContainer = container;
        container.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'dg-stats';

        const heading = document.createElement('h3');
        heading.textContent = 'Streak Stats';
        wrap.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'dg-stats-grid';

        const cards = [
            { value: String(this._currentStreak), label: 'Current Streak' },
            { value: String(this._longestStreak), label: 'Longest Streak' },
            { value: String(this._totalDaysMet), label: 'Days Met' },
        ];

        cards.forEach((c) => {
            const card = document.createElement('div');
            card.className = 'dg-stat-card';

            const val = document.createElement('div');
            val.className = 'dg-stat-value';
            val.textContent = c.value;

            const lbl = document.createElement('div');
            lbl.className = 'dg-stat-label';
            lbl.textContent = c.label;

            card.appendChild(val);
            card.appendChild(lbl);
            grid.appendChild(card);
        });

        wrap.appendChild(grid);

        const todayBar = document.createElement('div');
        todayBar.className = 'dg-today-bar';
        if (this._goalReachedToday) todayBar.classList.add('dg-today-bar-complete');

        const barHeader = document.createElement('div');
        barHeader.className = 'dg-today-bar-header';

        const barLeft = document.createElement('span');
        barLeft.textContent = "Today's progress";

        const barRight = document.createElement('span');
        const listenedMin = Math.floor(this._todaySeconds / 60);
        barRight.textContent = `${listenedMin} / ${this._goalMinutes} min`;

        barHeader.appendChild(barLeft);
        barHeader.appendChild(barRight);
        todayBar.appendChild(barHeader);

        const barTrack = document.createElement('div');
        barTrack.className = 'dg-today-bar-track';

        const barFill = document.createElement('div');
        barFill.className = 'dg-today-bar-fill';
        barFill.style.width = `${Math.min(this.getProgress() * 100, 100)}%`;

        barTrack.appendChild(barFill);
        todayBar.appendChild(barTrack);
        wrap.appendChild(todayBar);

        const streakLabel = document.createElement('div');
        streakLabel.className = 'dg-streak-label';
        streakLabel.innerHTML =
            this._currentStreak > 0
                ? `<strong>${this._currentStreak}</strong> day streak — keep it going!`
                : 'Listen to your goal today to start a streak!';
        wrap.appendChild(streakLabel);

        container.appendChild(wrap);
        this._statsWrap = wrap;
    }

    _updateStatsUI() {
        if (!this._statsContainer) return;
        this.renderStatsUI(this._statsContainer);
    }
}
