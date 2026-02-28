/* =========================================
   H&L Cleaning Co. — Dirty Window Overlay
   Progressive score-based cleaning: every
   selection cleans ~25%, 4 picks = spotless.
   ========================================= */

(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var canvas = document.getElementById('dirtyWindowCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // ---- Config ----
    var WARM_BROWN = { r: 120, g: 100, b: 75 };
    var DUST_BROWN = { r: 145, g: 125, b: 100 };
    var LERP_SPEED = prefersReducedMotion ? 1 : 0.16;
    var CLEAN_AT = 4; // fully clean after this many selections
    var MAX_DPR = 2;
    var MOBILE_BP = 768;

    var dpr, W, H, isMobile;
    var animating = false;
    var rafId = null;
    var resizeTimer = null;
    var dirtElements = [];
    var textureCache = {};
    var hazeOpacity = 1;
    var hazeTarget = 1;
    var hazeTexture = null;
    var hintFaded = false;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        W = window.innerWidth;
        H = window.innerHeight;
        isMobile = W <= MOBILE_BP;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- Helpers ----
    function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
    function rand(min, max) { return min + Math.random() * (max - min); }
    function randInt(min, max) { return Math.round(rand(min, max)); }

    // ===================================================
    // TEXTURE GENERATORS
    // ===================================================

    function createHaze(w, h) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');

        cx.fillStyle = rgba(DUST_BROWN, 0.06);
        cx.fillRect(0, 0, w, h);

        var grad = cx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, rgba(DUST_BROWN, 0.04));
        grad.addColorStop(1, rgba(WARM_BROWN, 0.12));
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);

        for (var i = 0; i < (w * h) * 0.0003; i++) {
            cx.fillStyle = rgba(WARM_BROWN, rand(0.03, 0.1));
            var s = rand(1, 3);
            cx.fillRect(Math.random() * w, Math.random() * h, s, s * rand(0.5, 1.5));
        }
        return c;
    }

    function createSmudge(w, h) {
        var key = 'sm' + w + '_' + h;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');

        var grad = cx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2.2);
        grad.addColorStop(0, rgba(WARM_BROWN, 0.35));
        grad.addColorStop(0.3, rgba(WARM_BROWN, 0.25));
        grad.addColorStop(0.6, rgba(WARM_BROWN, 0.12));
        grad.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.save();
        cx.scale(1, h / w);
        cx.beginPath();
        cx.arc(w / 2, w / 2, w / 2.2, 0, Math.PI * 2);
        cx.fillStyle = grad;
        cx.fill();
        cx.restore();

        var ox = w * rand(0.3, 0.7), oy = h * rand(0.3, 0.7);
        var g2 = cx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.3);
        g2.addColorStop(0, rgba(WARM_BROWN, 0.2));
        g2.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.fillStyle = g2;
        cx.beginPath();
        cx.arc(ox, oy, w * 0.3, 0, Math.PI * 2);
        cx.fill();

        for (var i = 0; i < w * h * 0.03; i++) {
            var nx = Math.random() * w, ny = Math.random() * h;
            var d = Math.sqrt(Math.pow((nx - w / 2) / (w / 2), 2) + Math.pow((ny - h / 2) / (h / 2), 2));
            if (d < 1) {
                cx.fillStyle = rgba(WARM_BROWN, rand(0.04, 0.15));
                cx.fillRect(nx, ny, rand(1, 2.5), rand(1, 2.5));
            }
        }
        textureCache[key] = c;
        return c;
    }

    function createFingerprint(size) {
        var key = 'fp' + size;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var cx = c.getContext('2d');

        var bg = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.42);
        bg.addColorStop(0, rgba(WARM_BROWN, 0.18));
        bg.addColorStop(0.7, rgba(WARM_BROWN, 0.08));
        bg.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.fillStyle = bg;
        cx.beginPath();
        cx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
        cx.fill();

        cx.translate(size / 2, size / 2);
        cx.rotate(Math.random() * Math.PI);
        for (var i = -10; i <= 10; i++) {
            cx.beginPath();
            var y = i * (size / 26);
            var curve = (Math.random() - 0.5) * 8;
            cx.moveTo(-size / 2.8, y);
            cx.quadraticCurveTo(curve, y + curve * 0.4, size / 2.8, y + (Math.random() - 0.5) * 5);
            cx.strokeStyle = rgba(WARM_BROWN, 0.1 + Math.random() * 0.12);
            cx.lineWidth = 1 + Math.random() * 0.8;
            cx.stroke();
        }
        textureCache[key] = c;
        return c;
    }

    function createHandprint(size) {
        var key = 'hp' + size;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        var cw = Math.round(size * 1.4), ch = size;
        c.width = cw; c.height = ch;
        var cx = c.getContext('2d');

        var px = cw * 0.45, py = ch * 0.58, pr = size * 0.3;
        var pg = cx.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, rgba(WARM_BROWN, 0.28));
        pg.addColorStop(0.6, rgba(WARM_BROWN, 0.14));
        pg.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.fillStyle = pg;
        cx.save(); cx.scale(1, 1.15);
        cx.beginPath(); cx.arc(px, py / 1.15, pr, 0, Math.PI * 2); cx.fill();
        cx.restore();

        var fingers = [
            { x: 0.15, y: 0.2, rx: 0.08, ry: 0.12 },
            { x: 0.3, y: 0.08, rx: 0.075, ry: 0.13 },
            { x: 0.48, y: 0.04, rx: 0.075, ry: 0.14 },
            { x: 0.65, y: 0.1, rx: 0.07, ry: 0.12 },
            { x: 0.82, y: 0.24, rx: 0.06, ry: 0.1 }
        ];
        fingers.forEach(function (f) {
            var fx = f.x * cw, fy = f.y * ch;
            var frx = f.rx * size, fry = f.ry * size;
            var fg = cx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(frx, fry));
            fg.addColorStop(0, rgba(WARM_BROWN, 0.25));
            fg.addColorStop(0.7, rgba(WARM_BROWN, 0.1));
            fg.addColorStop(1, rgba(WARM_BROWN, 0));
            cx.save(); cx.scale(frx / fry, 1);
            cx.beginPath(); cx.arc(fx * (fry / frx), fy, fry, 0, Math.PI * 2);
            cx.fillStyle = fg; cx.fill(); cx.restore();
        });
        textureCache[key] = c;
        return c;
    }

    function createWaterSpots(size) {
        var key = 'ws' + size;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var cx = c.getContext('2d');

        var count = randInt(4, 6);
        for (var i = 0; i < count; i++) {
            var sx = size * rand(0.2, 0.8), sy = size * rand(0.2, 0.8);
            var sr = rand(size * 0.06, size * 0.16);
            var g = cx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr);
            g.addColorStop(0, rgba(DUST_BROWN, 0.04));
            g.addColorStop(0.5, rgba(DUST_BROWN, 0.02));
            g.addColorStop(0.75, rgba(WARM_BROWN, 0.2));
            g.addColorStop(1, rgba(WARM_BROWN, 0));
            cx.fillStyle = g;
            cx.beginPath(); cx.arc(sx, sy, sr, 0, Math.PI * 2); cx.fill();
        }
        textureCache[key] = c;
        return c;
    }

    function createDustStreak(w, h) {
        var key = 'ds' + w + '_' + h;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');

        cx.translate(w / 2, h / 2);
        cx.rotate((Math.random() - 0.5) * 0.4);
        var g = cx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, rgba(WARM_BROWN, 0));
        g.addColorStop(0.15, rgba(WARM_BROWN, 0.18));
        g.addColorStop(0.5, rgba(WARM_BROWN, 0.25));
        g.addColorStop(0.85, rgba(WARM_BROWN, 0.15));
        g.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.fillStyle = g;
        cx.beginPath(); cx.ellipse(0, 0, w / 2, h / 2.5, 0, 0, Math.PI * 2); cx.fill();

        for (var i = 0; i < 60; i++) {
            cx.fillStyle = rgba(WARM_BROWN, rand(0.06, 0.18));
            cx.fillRect((Math.random() - 0.5) * w * 0.85, (Math.random() - 0.5) * h * 0.5, rand(1, 2.5), rand(0.5, 1.5));
        }
        textureCache[key] = c;
        return c;
    }

    function createCornerGrime(size, corner) {
        var key = 'cg' + size + corner;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var cx = c.getContext('2d');

        var ox = (corner === 'tl' || corner === 'bl') ? 0 : size;
        var oy = (corner === 'tl' || corner === 'tr') ? 0 : size;

        var g = cx.createRadialGradient(ox, oy, 0, ox, oy, size * 0.95);
        g.addColorStop(0, rgba(WARM_BROWN, 0.38));
        g.addColorStop(0.2, rgba(WARM_BROWN, 0.25));
        g.addColorStop(0.45, rgba(WARM_BROWN, 0.12));
        g.addColorStop(0.7, rgba(WARM_BROWN, 0.05));
        g.addColorStop(1, rgba(WARM_BROWN, 0));
        cx.fillStyle = g;
        cx.fillRect(0, 0, size, size);

        for (var i = 0; i < 8; i++) {
            var bx = ox + (Math.random() - 0.5) * size * 0.7;
            var by = oy + (Math.random() - 0.5) * size * 0.7;
            var br = rand(size * 0.05, size * 0.15);
            if (bx >= -br && bx < size + br && by >= -br && by < size + br) {
                var bg = cx.createRadialGradient(bx, by, 0, bx, by, br);
                bg.addColorStop(0, rgba(WARM_BROWN, rand(0.1, 0.2)));
                bg.addColorStop(1, rgba(WARM_BROWN, 0));
                cx.fillStyle = bg;
                cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI * 2); cx.fill();
            }
        }

        for (var j = 0; j < size * 0.5; j++) {
            var px = ox + (Math.random() - 0.5) * size * 0.5;
            var py = oy + (Math.random() - 0.5) * size * 0.5;
            if (px >= 0 && px < size && py >= 0 && py < size) {
                cx.fillStyle = rgba(WARM_BROWN, rand(0.04, 0.14));
                cx.fillRect(px, py, rand(1, 3), rand(1, 3));
            }
        }
        textureCache[key] = c;
        return c;
    }

    function createGreaseSmudge(w, h) {
        var key = 'gs' + w + '_' + h;
        if (textureCache[key]) return textureCache[key];
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');

        for (var i = 0; i < 5; i++) {
            var ex = w * rand(0.25, 0.75), ey = h * rand(0.25, 0.75);
            var er = w * rand(0.12, 0.22);
            var g = cx.createRadialGradient(ex, ey, 0, ex, ey, er);
            g.addColorStop(0, rgba(WARM_BROWN, 0.3));
            g.addColorStop(0.4, rgba(WARM_BROWN, 0.18));
            g.addColorStop(1, rgba(WARM_BROWN, 0));
            cx.fillStyle = g;
            cx.save(); cx.scale(1, rand(0.7, 1.3));
            cx.beginPath(); cx.arc(ex, ey, er, 0, Math.PI * 2); cx.fill();
            cx.restore();
        }

        cx.strokeStyle = rgba(WARM_BROWN, 0.12);
        cx.lineWidth = 2; cx.lineCap = 'round';
        for (var j = 0; j < 3; j++) {
            cx.beginPath();
            cx.moveTo(w * rand(0.2, 0.4), h * rand(0.3, 0.7));
            cx.quadraticCurveTo(w * rand(0.4, 0.6), h * rand(0.2, 0.8), w * rand(0.6, 0.8), h * rand(0.3, 0.7));
            cx.stroke();
        }
        textureCache[key] = c;
        return c;
    }

    // ---- Sparkle ----
    function drawSparkle(x, y, size, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = 'rgba(122,154,126,' + opacity + ')';
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        var arm = size / 2;
        ctx.beginPath();
        ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
        var d = arm * 0.55;
        ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
        ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
        ctx.stroke();
        ctx.fillStyle = 'rgba(168,197,171,' + (opacity * 0.7) + ')';
        ctx.beginPath(); ctx.arc(x, y, size * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ---- Zone placement ----
    function zonePos(zone) {
        var m = isMobile ? 0.02 : 0.04;
        var ew = isMobile ? 0.28 : 0.22;
        switch (zone) {
            case 'left':   return { x: W * (m + Math.random() * ew), y: H * rand(0.12, 0.88) };
            case 'right':  return { x: W * (1 - m - Math.random() * ew), y: H * rand(0.12, 0.88) };
            case 'top-left':    return { x: W * rand(m, 0.2), y: H * rand(m, 0.2) };
            case 'top-right':   return { x: W * rand(0.8, 1 - m), y: H * rand(m, 0.2) };
            case 'bottom-left': return { x: W * rand(m, 0.22), y: H * rand(0.75, 0.95) };
            case 'bottom-right':return { x: W * rand(0.78, 1 - m), y: H * rand(0.75, 0.95) };
            default:            return { x: Math.random() * W, y: Math.random() * H };
        }
    }

    // ---- Build dirt with tier assignments ----
    // Tiers 1-4: tier N cleans when score >= N
    function buildDirt() {
        var s = isMobile ? 0.65 : 1;
        var els = [];

        function add(tier, type, texture, zone, pos, sz) {
            els.push({
                tier: tier, type: type, texture: texture,
                zone: zone, pos: pos, size: sz,
                opacity: 1, target: 1, scale: 1, targetScale: 1
            });
        }

        // === TIER 1 — cleans on first selection ===
        // Large corner grime top-left
        var cg1 = Math.round(rand(280, 400) * s);
        add(1, 'corner', createCornerGrime(cg1, 'tl'), 'top-left', { x: 0, y: 0 }, cg1);
        // Big smudge left edge
        var sm1W = Math.round(rand(180, 260) * s), sm1H = Math.round(sm1W * rand(0.5, 0.65));
        add(1, 'smudge', createSmudge(sm1W, sm1H), 'left', zonePos('left'), sm1W);
        // Fingerprint right edge
        var fp1 = Math.round(rand(70, 100) * s);
        add(1, 'fingerprint', createFingerprint(fp1), 'right', zonePos('right'), fp1);
        // Dust streak across bottom
        var ds1W = Math.round(rand(220, 340) * s), ds1H = Math.round(rand(35, 55) * s);
        add(1, 'duststreak', createDustStreak(ds1W, ds1H), 'bottom-left', zonePos('bottom-left'), ds1W);
        // Water spots bottom-right
        var ws1 = Math.round(rand(80, 120) * s);
        add(1, 'waterspot', createWaterSpots(ws1), 'bottom-right', zonePos('bottom-right'), ws1);

        // === TIER 2 — cleans on second selection ===
        // Corner grime top-right
        var cg2 = Math.round(rand(240, 360) * s);
        add(2, 'corner', createCornerGrime(cg2, 'tr'), 'top-right', { x: W - cg2, y: 0 }, cg2);
        // Handprint left edge
        var hp1 = Math.round(rand(95, 135) * s);
        add(2, 'handprint', createHandprint(hp1), 'left', zonePos('left'), hp1);
        // Smudge right edge
        var sm2W = Math.round(rand(150, 220) * s), sm2H = Math.round(sm2W * rand(0.45, 0.6));
        add(2, 'smudge', createSmudge(sm2W, sm2H), 'right', zonePos('right'), sm2W);
        // Grease top-left area
        var gs1W = Math.round(rand(140, 210) * s), gs1H = Math.round(gs1W * rand(0.5, 0.7));
        add(2, 'grease', createGreaseSmudge(gs1W, gs1H), 'top-left', zonePos('top-left'), gs1W);
        // Fingerprint left
        var fp2 = Math.round(rand(60, 85) * s);
        add(2, 'fingerprint', createFingerprint(fp2), 'left', zonePos('left'), fp2);

        // === TIER 3 — cleans on third selection ===
        // Corner grime bottom-left
        var cg3 = Math.round(rand(220, 320) * s);
        add(3, 'corner', createCornerGrime(cg3, 'bl'), 'bottom-left', { x: 0, y: H - cg3 }, cg3);
        // Smudge left
        var sm3W = Math.round(rand(130, 190) * s), sm3H = Math.round(sm3W * rand(0.5, 0.6));
        add(3, 'smudge', createSmudge(sm3W, sm3H), 'left', zonePos('left'), sm3W);
        // Dust streak right
        var ds2W = Math.round(rand(180, 280) * s), ds2H = Math.round(rand(28, 45) * s);
        add(3, 'duststreak', createDustStreak(ds2W, ds2H), 'right', zonePos('right'), ds2W);
        // Water spots left
        var ws2 = Math.round(rand(70, 100) * s);
        add(3, 'waterspot', createWaterSpots(ws2), 'bottom-left', zonePos('bottom-left'), ws2);
        // Fingerprint top-right
        var fp3 = Math.round(rand(55, 80) * s);
        add(3, 'fingerprint', createFingerprint(fp3), 'top-right', zonePos('top-right'), fp3);

        // === TIER 4 — cleans on fourth selection (fully clean) ===
        // Corner grime bottom-right
        var cg4 = Math.round(rand(200, 300) * s);
        add(4, 'corner', createCornerGrime(cg4, 'br'), 'bottom-right', { x: W - cg4, y: H - cg4 }, cg4);
        // Smudge right
        var sm4W = Math.round(rand(120, 180) * s), sm4H = Math.round(sm4W * rand(0.45, 0.6));
        add(4, 'smudge', createSmudge(sm4W, sm4H), 'right', zonePos('right'), sm4W);
        // Grease bottom area
        var gs2W = Math.round(rand(110, 170) * s), gs2H = Math.round(gs2W * rand(0.5, 0.65));
        add(4, 'grease', createGreaseSmudge(gs2W, gs2H), 'bottom-right', zonePos('bottom-right'), gs2W);
        // Handprint right
        var hp2 = Math.round(rand(80, 115) * s);
        add(4, 'handprint', createHandprint(hp2), 'right', zonePos('right'), hp2);
        // Fingerprint left
        var fp4 = Math.round(rand(55, 75) * s);
        add(4, 'fingerprint', createFingerprint(fp4), 'left', zonePos('left'), fp4);

        return els;
    }

    // ---- Sparkle state ----
    var sparkles = [];
    var sparkleActive = false;

    function generateSparkles() {
        sparkles = [];
        var count = isMobile ? 8 : 14;
        for (var i = 0; i < count; i++) {
            sparkles.push({
                x: W * (0.08 + Math.random() * 0.84),
                y: H * (0.08 + Math.random() * 0.84),
                size: rand(12, 24),
                phase: Math.random() * Math.PI * 2,
                speed: rand(1.5, 3),
                opacity: 0, target: 0
            });
        }
    }

    // ---- Calculate score from state ----
    // Every individual pick counts: each room, each bathroom, each toggle, each load, each window
    function calcScore(state) {
        var score = 0;
        score += state.rooms;           // each room = +1
        score += state.bathrooms;       // each bathroom = +1
        if (state.deepclean) score++;   // toggle = +1
        score += state.laundryWD;       // each load = +1
        score += state.laundryWDF;      // each load = +1
        score += state.windows;         // each window = +1
        if (state.fridge) score++;      // toggle = +1
        if (state.oven) score++;        // toggle = +1
        return score;
    }

    // ---- State mapping ----
    function updateDirtFromState(state) {
        var score = calcScore(state);

        // Fade hint after first selection
        if (score > 0 && !hintFaded) {
            hintFaded = true;
            var hint = document.getElementById('dirtyHint');
            if (hint) setTimeout(function () { hint.classList.add('faded'); }, 1500);
        }

        // Each element cleans when score >= its tier
        dirtElements.forEach(function (el) {
            var clean = score >= el.tier;
            el.target = clean ? 0 : 1;
            el.targetScale = clean ? 0.8 : 1;
        });

        // Haze fades proportionally: 0 at CLEAN_AT, 1 at 0
        var ratio = Math.min(score / CLEAN_AT, 1);
        hazeTarget = 1 - ratio;

        // Sparkle when fully clean
        sparkleActive = score >= CLEAN_AT;
        sparkles.forEach(function (s) { s.target = sparkleActive ? 1 : 0; });

        startAnimation();
    }

    // ---- Render ----
    function render() {
        ctx.clearRect(0, 0, W, H);
        var settled = true;

        // Haze
        hazeOpacity += (hazeTarget - hazeOpacity) * LERP_SPEED;
        if (Math.abs(hazeOpacity - hazeTarget) > 0.003) settled = false;
        if (hazeOpacity > 0.003 && hazeTexture) {
            ctx.save();
            ctx.globalAlpha = hazeOpacity;
            ctx.drawImage(hazeTexture, 0, 0, W, H);
            ctx.restore();
        }

        // Dirt elements
        dirtElements.forEach(function (el) {
            el.opacity += (el.target - el.opacity) * LERP_SPEED;
            el.scale += (el.targetScale - el.scale) * LERP_SPEED;
            if (Math.abs(el.opacity - el.target) > 0.003 || Math.abs(el.scale - el.targetScale) > 0.003) settled = false;
            if (el.opacity < 0.003) return;

            ctx.save();
            ctx.globalAlpha = el.opacity;
            if (Math.abs(el.scale - 1) > 0.01) {
                ctx.translate(el.pos.x, el.pos.y);
                ctx.scale(el.scale, el.scale);
                ctx.drawImage(el.texture, -el.texture.width / 2, -el.texture.height / 2);
            } else {
                ctx.drawImage(el.texture, el.pos.x - el.texture.width / 2, el.pos.y - el.texture.height / 2);
            }
            ctx.restore();
        });

        // Sparkles
        if (sparkleActive || sparkles.some(function (s) { return s.opacity > 0.01; })) {
            var t = performance.now() / 1000;
            sparkles.forEach(function (s) {
                s.opacity += (s.target - s.opacity) * LERP_SPEED;
                if (Math.abs(s.opacity - s.target) > 0.003) settled = false;
                if (s.opacity > 0.01) {
                    var pulse = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
                    drawSparkle(s.x, s.y, s.size * (0.7 + pulse * 0.3), s.opacity * pulse);
                }
            });
            if (sparkleActive) settled = false;
        }

        if (settled) { animating = false; rafId = null; }
        else { rafId = requestAnimationFrame(render); }
    }

    function startAnimation() {
        if (!animating) { animating = true; rafId = requestAnimationFrame(render); }
    }

    // ---- Init ----
    function init() {
        resize();
        hazeTexture = createHaze(W, H);
        dirtElements = buildDirt();
        generateSparkles();
        startAnimation();
    }

    // ---- Events ----
    document.addEventListener('packageUpdate', function (e) {
        if (e.detail) updateDirtFromState(e.detail);
    });

    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var oW = W, oH = H;
            resize();
            hazeTexture = createHaze(W, H);

            dirtElements.forEach(function (el) {
                if (el.type === 'corner') {
                    if (el.zone === 'top-left')     { el.pos = { x: 0, y: 0 }; }
                    else if (el.zone === 'top-right')    { el.pos = { x: W - el.size, y: 0 }; }
                    else if (el.zone === 'bottom-left')  { el.pos = { x: 0, y: H - el.size }; }
                    else if (el.zone === 'bottom-right') { el.pos = { x: W - el.size, y: H - el.size }; }
                } else {
                    el.pos.x = (el.pos.x / oW) * W;
                    el.pos.y = (el.pos.y / oH) * H;
                }
            });
            sparkles.forEach(function (s) { s.x = (s.x / oW) * W; s.y = (s.y / oH) * H; });
            startAnimation();
        }, 150);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
