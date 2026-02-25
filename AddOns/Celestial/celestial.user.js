// ==UserScript==
// @name         Celestial AddOn for OpenHamClock
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  Real-time star chart and antenna aiming aid for OpenHamClock
// @author       DO3EET
// @match        https://openhamclock.com/*
// @match        http://localhost:*/*
// @match        file:///*
// @require      https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js
// @require      https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial/celestial.min.js
// @grant        none
// ==/UserScript==

/**
 * Celestial AddOn for OpenHamClock
 * 
 * This project incorporates or is derived from d3-celestial by Olaf Frohn.
 * Copyright (c) 2015, Olaf Frohn. All rights reserved.
 */

(function() {
    'use strict';

    let isMapInitialized = false;

    const translations = {
        de: {
            title: '✨ Celestial',
            description: 'Aktueller Sternenhimmel (Zenit)',
        },
        en: {
            title: '✨ Celestial',
            description: 'Current Sky (Zenith)',
        }
    };

    let lang = document.documentElement.lang.startsWith('de') ? 'de' : 'en';
    const t = (key) => translations[lang][key] || key;

    const styles = `
        /* SHARED DRAWER STYLES */
        #ohc-addon-drawer {
            position: fixed;
            top: 100px;
            right: 20px;
            display: flex;
            flex-direction: row-reverse;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            pointer-events: none;
            user-select: none;
        }
        #ohc-addon-drawer.ohc-vertical {
            flex-direction: column-reverse;
        }
        .ohc-addon-icon {
            width: 45px;
            height: 45px;
            background: var(--bg-panel, rgba(17, 24, 32, 0.95));
            border: 1px solid var(--border-color, rgba(255, 180, 50, 0.3));
            border-radius: 50%;
            color: var(--accent-cyan, #00ddff);
            font-size: 20px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
            transition: all 0.3s ease;
        }
        .ohc-addon-icon:hover { border-color: var(--accent-amber, #ffb432); transform: scale(1.1); }
        #ohc-addon-launcher { background: var(--bg-tertiary, #1a2332); color: var(--accent-amber); cursor: move; }
        .ohc-addon-item { display: none; }

        /* CELESTIAL SPECIFIC STYLES */
        #ohc-celestial-container {
            position: fixed;
            top: 180px;
            right: 20px;
            width: 450px;
            background: var(--bg-panel, rgba(17, 24, 32, 0.95));
            border: 1px solid var(--border-color, rgba(255, 180, 50, 0.3));
            border-radius: 8px;
            color: var(--text-primary, #f0f4f8);
            font-family: 'JetBrains Mono', monospace, sans-serif;
            z-index: 10001;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            backdrop-filter: blur(5px);
        }
        #ohc-celestial-header {
            padding: 10px;
            background: rgba(155, 89, 182, 0.15);
            border-bottom: 1px solid var(--border-color, rgba(255, 180, 50, 0.2));
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px 8px 0 0;
        }
        #ohc-celestial-header h3 { margin: 0; font-size: 14px; color: var(--accent-purple, #9b59b6); }
        #ohc-celestial-content { padding: 12px; font-size: 12px; height: 420px; position: relative; overflow: hidden; background: #000; border-radius: 0 0 8px 8px; }
        #celestial-map { width: 100%; height: 100%; }
        .ohc-celestial-close { cursor: pointer; color: var(--text-muted); font-size: 20px; }
        .ohc-celestial-close:hover { color: var(--text-primary); }
    `;

    function getOHCLocation() {
        try {
            const config = JSON.parse(localStorage.getItem('openhamclock_config'));
            if (config && config.location) {
                return [config.location.lat, config.location.lon];
            }
        } catch (e) { console.error("Celestial: Could not read OHC location", e); }
        return [52.52, 13.40]; 
    }

    function initMap() {
        if (isMapInitialized) return; // Only initialize once!

        const [lat, lon] = getOHCLocation();
        console.log(`Celestial AddOn: Initializing map for Lat: ${lat}, Lon: ${lon}`);
        
        const celestial = window.Celestial || Celestial;
        if (typeof celestial === 'undefined') {
            console.error("Celestial AddOn: Celestial library not found!");
            return;
        }

        const config = { 
            width: 420,           
            projection: "orthographic", 
            container: "celestial-map",
            center: [lon, lat, 0], 
            orientation: [lat, 0, 0],
            follow: "zenith",      
            geopos: [lat, lon],    
            background: { fill: "transparent", stroke: "#000", opacity: 1 },
            datapath: "https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial/data/",
            stars: { show: true, limit: 5, colors: true, names: true, size: 4 },
            planets: { show: true, symbol: true, names: true },
            constellations: { show: true, names: true, line: true, color: "#9b59b6", opacity: 0.3 },
            lines: { graticule: { show: true, step: [15, 15] } }
        };

        try {
            celestial.display(config);
            isMapInitialized = true;
        } catch (e) { console.error("Celestial: display error", e); }
    }

    async function init() {
        if (!document.body) return;
        console.log("Celestial AddOn: Initializing...");

        if (!document.getElementById("ohc-celestial-styles")) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "ohc-celestial-styles";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
        }

        let drawer = document.getElementById("ohc-addon-drawer");
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'ohc-addon-drawer';

            const updateLayout = () => {
                if (!drawer) return;
                const rect = drawer.getBoundingClientRect();
                const winW = window.innerWidth;
                const winH = window.innerHeight;
                const isRight = rect.left + rect.width / 2 > winW / 2;
                const isBottom = rect.top + rect.height / 2 > winH / 2;
                const isVert = drawer.classList.contains('ohc-vertical');
                if (isVert) {
                    drawer.style.flexDirection = isBottom ? 'column-reverse' : 'column';
                } else {
                    drawer.style.flexDirection = isRight ? 'row-reverse' : 'row';
                }
            };

            const savedLayout = localStorage.getItem('ohc_addon_layout') || 'horizontal';
            if (savedLayout === 'vertical') drawer.classList.add('ohc-vertical');
            const savedPos = JSON.parse(localStorage.getItem('ohc_addon_pos') || '{}');
            if (savedPos.top) drawer.style.top = savedPos.top;
            if (savedPos.bottom) drawer.style.bottom = savedPos.bottom;
            if (savedPos.left) drawer.style.left = savedPos.left;
            if (savedPos.right) drawer.style.right = savedPos.right;
            if (!savedPos.top && !savedPos.bottom) {
                drawer.style.top = '100px';
                drawer.style.right = '20px';
            }

            const launcher = document.createElement('div');
            launcher.id = 'ohc-addon-launcher';
            launcher.className = 'ohc-addon-icon';
            launcher.innerHTML = '\uD83E\uDDE9';
            launcher.title = 'L: Toggle | M: Drag | R: Rotate';
            launcher.onclick = () => {
                const items = document.querySelectorAll('.ohc-addon-item');
                const isHidden = Array.from(items).some((el) => el.style.display !== 'flex');
                items.forEach((el) => (el.style.display = isHidden ? 'flex' : 'none'));
                launcher.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                updateLayout();
            };
            launcher.oncontextmenu = (e) => {
                e.preventDefault();
                drawer.classList.toggle('ohc-vertical');
                localStorage.setItem('ohc_addon_layout', drawer.classList.contains('ohc-vertical') ? 'vertical' : 'horizontal');
                updateLayout();
            };

            let isDragging = false;
            let startX, startY, startTop, startLeft;
            launcher.onmousedown = (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    isDragging = true;
                    startX = e.clientX; startY = e.clientY;
                    const rect = drawer.getBoundingClientRect();
                    startTop = rect.top; startLeft = rect.left;
                    launcher.style.cursor = 'grabbing';
                }
            };
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX; const dy = e.clientY - startY;
                drawer.style.top = (startTop + dy) + 'px';
                drawer.style.left = (startLeft + dx) + 'px';
                drawer.style.right = 'auto'; drawer.style.bottom = 'auto';
            });
            document.addEventListener('mouseup', () => {
                if (!isDragging) return;
                isDragging = false; launcher.style.cursor = 'move';
                const rect = drawer.getBoundingClientRect();
                const winW = window.innerWidth; const winH = window.innerHeight;
                const isRight = rect.left + rect.width / 2 > winW / 2;
                const isBottom = rect.top + rect.height / 2 > winH / 2;
                const pos = {};
                if (isRight) {
                    drawer.style.left = 'auto'; drawer.style.right = Math.max(0, winW - rect.right) + 'px';
                    pos.right = drawer.style.right;
                } else {
                    drawer.style.right = 'auto'; drawer.style.left = Math.max(0, rect.left) + 'px';
                    pos.left = drawer.style.left;
                }
                if (isBottom) {
                    drawer.style.top = 'auto'; drawer.style.bottom = Math.max(0, winH - rect.bottom) + 'px';
                    pos.bottom = drawer.style.bottom;
                } else {
                    drawer.style.bottom = 'auto'; drawer.style.top = Math.max(0, rect.top) + 'px';
                    pos.top = drawer.style.top;
                }
                localStorage.setItem('ohc_addon_pos', JSON.stringify(pos));
                updateLayout();
            });

            drawer.appendChild(launcher);
            document.body.appendChild(drawer);
            setTimeout(updateLayout, 100);
        }

        if (document.getElementById("ohc-celestial-toggle")) return;

        const toggleBtn = document.createElement("div");
        toggleBtn.id = "ohc-celestial-toggle";
        toggleBtn.className = "ohc-addon-icon ohc-addon-item";
        toggleBtn.innerHTML = "✨";
        toggleBtn.title = t('title');
        drawer.appendChild(toggleBtn);

        const container = document.createElement("div");
        container.id = "ohc-celestial-container";
        container.innerHTML = `
            <div id="ohc-celestial-header">
                <h3>${t('title')}</h3>
                <span class="ohc-celestial-close">&times;</span>
            </div>
            <div id="ohc-celestial-content">
                <div id="celestial-map"></div>
            </div>
        `;
        document.body.appendChild(container);

        toggleBtn.onclick = () => {
            const isVisible = container.style.display === "flex";
            if (!isVisible) {
                container.style.display = "flex";
                // Only call initMap if not already done
                if (!isMapInitialized) {
                    initMap();
                }
            } else {
                container.style.display = "none";
            }
        };

        container.querySelector('.ohc-celestial-close').onclick = () => {
            container.style.display = "none";
        };

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        document.getElementById("ohc-celestial-header").onmousedown = (e) => {
            if (e.target.className === 'ohc-celestial-close') return;
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
                pos3 = e.clientX; pos4 = e.clientY;
                container.style.top = (container.offsetTop - pos2) + "px";
                container.style.left = (container.offsetLeft - pos1) + "px";
                container.style.right = 'auto';
            };
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
