// Lo splash della pagina principale, nello stile di quello del gioco (scripts/ui/splash.gd): al buio i cubetti voxel
// cadono e compongono «Runess», scritto col Jacquard 24 del titolo del gioco; la cometa azzurra del dardo incantato
// lo attraversa e lo accende d'oro, che poi trema come la luce di una candela. Con un clic, un tasto, o da solo dopo
// qualche secondo, i cubetti prendono fuoco dal basso, diventano cenere e si sbriciolano, e sotto c'è il sito.
// Una volta per sessione (sessionStorage), mai a chi chiede meno movimento (lo decide lo script in cima alla pagina,
// con la classe splash-on). Canvas 2D, senza librerie.
(function () {
	"use strict";
	var root = document.documentElement;
	var splash = document.getElementById("splash");
	if (!splash || !root.classList.contains("splash-on")) return;

	var TEXT = "Runess";
	var FONT = '24px "Jacquard"';
	// Se il font non arriva: lettere 5 x 7, come quelle dello splash del gioco ("#" è un cubetto)
	var GLYPHS = {
		R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
		U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
		N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
		E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
		S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."]
	};
	// I tempi, in secondi
	var ASSEMBLE = 0.25;   // quando cominciano a cadere i cubetti
	var FALL = 0.6;        // quanto ci mette a cadere un cubetto
	var COMET_AT = 1.55;   // quando parte la cometa
	var COMET_TIME = 1.05; // quanto ci mette ad attraversare lo schermo
	var HOLD = 2.6;        // quanto resta acceso il titolo prima di bruciare da solo
	var BURN = 0.75;       // quanto brucia un cubetto prima di sbriciolarsi
	var ASH = 1.4;         // quanto dura la cenere
	var MAX_TIME = 12;     // per sicurezza: lo splash se ne va comunque

	var canvas = splash.querySelector("canvas");
	var ctx = canvas.getContext("2d");
	var dpr = 1, W = 0, H = 0;
	var cells = [];        // i cubetti: posto nella griglia, partenza, colore, accensione, fuoco
	var cols = 0, rows = 0;
	var size = 8, depth = 3, ox = 0, oy = 0;
	var particles = [];    // scintille, fiamme e cenere: quadratini
	var motes = [];        // il pulviscolo
	var trail = [];        // la scia della cometa
	var sprites = new Map();
	var start = 0, now = 0, leaveAt = -1, ready = false, done = false, frame = 0;

	// --- Colori -----------------------------------------------------------------
	var STONE = [52, 40, 31];
	var GOLD = [242, 191, 77];
	var FLARE = [232, 248, 255];
	var BOLT = [143, 216, 255];
	var HOT = [255, 150, 48];
	var RED = [196, 52, 28];
	var CHAR = [44, 32, 26];
	var ASH_GREY = [112, 104, 98];

	function mix(a, b, t) {
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	}
	function scale(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
	function css(c, a) {
		return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a === undefined ? 1 : a) + ")";
	}
	function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); }
	function easeBack(t) {
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		var c = 1.6;
		return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
	}
	function rand(a, b) { return a + Math.random() * (b - a); }

	// Un cubetto di quel colore già disegnato, con le facce di sopra e di destra come le miniature voxel della wiki
	function sprite(color) {
		var q = color.map(function (v) { return Math.max(0, Math.min(255, Math.round(v / 6) * 6)); });
		var key = q.join(",");
		var s = sprites.get(key);
		if (s) return s;
		if (sprites.size > 700) sprites.clear();
		var px = Math.max(1, Math.round(size * dpr));
		var pd = Math.max(1, Math.round(depth * dpr));
		s = document.createElement("canvas");
		s.width = px + pd;
		s.height = px + pd;
		var g = s.getContext("2d");
		g.fillStyle = css(q);
		g.fillRect(0, pd, px, px);
		g.fillStyle = css(mix(q, [255, 255, 255], 0.28));
		g.beginPath(); g.moveTo(0, pd); g.lineTo(pd, 0); g.lineTo(px + pd, 0); g.lineTo(px, pd); g.closePath(); g.fill();
		g.fillStyle = css(scale(q, 0.62));
		g.beginPath(); g.moveTo(px, pd); g.lineTo(px + pd, 0); g.lineTo(px + pd, px); g.lineTo(px, px + pd); g.closePath(); g.fill();
		g.fillStyle = "rgba(0,0,0,0.18)";  // un filo d'ombra sotto, perché si vedano i cubetti uno per uno
		g.fillRect(0, pd + px - Math.max(1, Math.round(dpr)), px, Math.max(1, Math.round(dpr)));
		sprites.set(key, s);
		return s;
	}

	// --- La scritta in cubetti ---------------------------------------------------
	function fromFont() {
		var c = document.createElement("canvas");
		c.width = 260;
		c.height = 48;
		var g = c.getContext("2d");
		g.font = FONT;
		g.textBaseline = "alphabetic";
		g.fillStyle = "#fff";
		g.fillText(TEXT, 6, 32);
		var data = g.getImageData(0, 0, c.width, c.height).data;
		var on = [];
		var minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
		for (var y = 0; y < c.height; y++) {
			for (var x = 0; x < c.width; x++) {
				if (data[(y * c.width + x) * 4 + 3] > 120) {
					on.push([x, y]);
					if (x < minX) minX = x;
					if (y < minY) minY = y;
					if (x > maxX) maxX = x;
					if (y > maxY) maxY = y;
				}
			}
		}
		if (on.length < 80) return null;  // il font non c'è: un'altra scritta, troppo piccola o sfocata
		return { cols: maxX - minX + 1, rows: maxY - minY + 1, on: on.map(function (p) { return [p[0] - minX, p[1] - minY]; }) };
	}

	function fromGlyphs() {
		var on = [];
		var x0 = 0;
		TEXT.toUpperCase().split("").forEach(function (ch) {
			var glyph = GLYPHS[ch];
			glyph.forEach(function (row, y) {
				for (var x = 0; x < row.length; x++) if (row[x] === "#") on.push([x0 + x, y]);
			});
			x0 += glyph[0].length + 1;
		});
		return { cols: x0 - 1, rows: 7, on: on };
	}

	function build(shape) {
		cols = shape.cols;
		rows = shape.rows;
		cells = shape.on.map(function (p) {
			return {
				gx: p[0], gy: p[1],
				delay: ASSEMBLE + (p[0] / cols) * 0.55 + rand(0, 0.35),
				fromX: rand(-6, 6), fromY: -rand(5, 16),   // da dove cade, in cubetti
				tint: rand(0.86, 1.08),
				phase: rand(0, Math.PI * 2),
				lit: -1,
				burn: -1,
				gone: false
			};
		});
		// dal basso verso l'alto, da sinistra a destra: così le facce di sopra e di destra le copre chi viene dopo
		cells.sort(function (a, b) { return b.gy - a.gy || a.gx - b.gx; });
		layout();
	}

	function layout() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = window.innerWidth;
		H = window.innerHeight;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.imageSmoothingEnabled = false;
		if (cols) {
			size = Math.floor(Math.min((W * 0.84) / cols, (H * 0.3) / rows));
			size = Math.max(3, Math.min(size, 22));
			depth = Math.max(1, Math.round(size * 0.42));
			ox = Math.round((W - cols * size - depth) / 2);
			oy = Math.round(H * 0.42 - (rows * size) / 2);
		}
		sprites.clear();
		if (!motes.length) {
			for (var i = 0; i < 60; i++) motes.push({ x: Math.random(), y: Math.random(), v: rand(0.004, 0.018), a: rand(0.05, 0.22), s: rand(1, 2.5) });
		}
	}

	// --- La cometa -----------------------------------------------------------------
	function cometAt(t) {
		var p = (t - COMET_AT) / COMET_TIME;
		var x = -0.12 * W + p * 1.24 * W;
		var mid = oy + rows * size * 0.5;
		var y = mid + Math.sin(p * Math.PI) * -rows * size * 0.35 + (p - 0.5) * rows * size * 0.5;
		return { p: p, x: x, y: y };
	}

	function drawComet(t) {
		var c = cometAt(t);
		if (c.p < -0.05 || c.p > 1.25) return;
		if (c.p <= 1.1) trail.push({ x: c.x, y: c.y, t: t });
		while (trail.length && t - trail[0].t > 0.45) trail.shift();
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		// la scia: un nastro di quadratini, sempre più piccoli e trasparenti, senza buchi fra un fotogramma e l'altro
		for (var i = 1; i < trail.length; i++) {
			var a = trail[i - 1], b = trail[i];
			var k = i / trail.length;
			var sq = Math.max(1, size * (0.2 + 0.75 * k));
			ctx.fillStyle = css(mix(BOLT, FLARE, k), 0.05 + 0.3 * k * k);
			var steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(2, sq * 0.6)));
			for (var st = 0; st < steps; st++) {
				var u = st / steps;
				ctx.fillRect(Math.round(a.x + (b.x - a.x) * u - sq / 2), Math.round(a.y + (b.y - a.y) * u - sq / 2), sq, sq);
			}
		}
		if (c.p <= 1.1) {
			// l'alone ad anelli netti
			var rings = [4.4, 3, 1.8];
			for (var r = 0; r < rings.length; r++) {
				ctx.beginPath();
				ctx.arc(c.x, c.y, size * rings[r], 0, Math.PI * 2);
				ctx.fillStyle = css(BOLT, 0.06 + r * 0.06);
				ctx.fill();
			}
			// la testa: cubetti che rotolano e tremano
			var head = Math.max(2, size * 0.7);
			for (var j = 0; j < 7; j++) {
				var ang = t * 9 + (j * Math.PI * 2) / 6;
				var rad = j === 6 ? 0 : size * 0.5;
				var hx = c.x + Math.cos(ang) * rad + rand(-0.6, 0.6);
				var hy = c.y + Math.sin(ang) * rad + rand(-0.6, 0.6);
				ctx.fillStyle = css(j === 6 ? [255, 255, 255] : mix(BOLT, FLARE, 0.6));
				ctx.fillRect(Math.round(hx - head / 2), Math.round(hy - head / 2), head, head);
			}
			for (var n = 0; n < 2; n++) {
				particles.push({ x: c.x, y: c.y, vx: rand(-260, -60), vy: rand(-90, 90), life: rand(0.25, 0.55), age: 0,
					s: Math.max(1, size * rand(0.15, 0.3)), from: FLARE, to: BOLT, g: 0, glow: true });
			}
		}
		ctx.restore();
		return c;
	}

	// --- Il colore di un cubetto in questo momento ------------------------------------
	function colorOf(cell, t) {
		var base = scale(STONE, cell.tint);
		if (cell.lit >= 0 && t >= cell.lit) {
			var since = t - cell.lit;
			var flicker = 1 - 0.12 * (0.5 + 0.5 * Math.sin(t * 7 + 1.7 * Math.sin(t * 1.9))) + 0.05 * Math.sin(t * 3.1 + cell.phase);
			var gold = scale(GOLD, flicker * (0.94 + 0.06 * cell.tint));
			base = since < 0.6 ? mix(FLARE, gold, ease(since / 0.6)) : gold;
		}
		if (cell.burn >= 0 && t >= cell.burn) {
			var b = (t - cell.burn) / BURN;
			if (b < 0.2) base = mix(base, HOT, b / 0.2);
			else if (b < 0.45) base = mix(HOT, RED, (b - 0.2) / 0.25);
			else if (b < 0.75) base = mix(RED, CHAR, (b - 0.45) / 0.3);
			else base = mix(CHAR, ASH_GREY, (b - 0.75) / 0.25);
		}
		return base;
	}

	// --- Disegno ---------------------------------------------------------------------
	function draw() {
		if (done) return;
		frame = requestAnimationFrame(draw);
		now = performance.now() / 1000;
		var t = now - start;
		var dt = Math.min(0.05, t - (draw.last || t));
		draw.last = t;
		ctx.clearRect(0, 0, W, H);

		// il pulviscolo
		for (var m = 0; m < motes.length; m++) {
			var mo = motes[m];
			mo.y -= mo.v * dt;
			mo.x += Math.sin(t * 0.4 + m) * 0.0004;
			if (mo.y < -0.02) { mo.y = 1.02; mo.x = Math.random(); }
			ctx.fillStyle = css([214, 163, 82], mo.a * (leaveAt >= 0 ? Math.max(0, 1 - (t - leaveAt)) : 1));
			ctx.fillRect(Math.round(mo.x * W), Math.round(mo.y * H), mo.s, mo.s);
		}
		if (t > MAX_TIME) { finish(); return; }
		if (!cols) return;

		// la luce dietro il titolo acceso
		var litCount = 0;
		for (var c0 = 0; c0 < cells.length; c0++) if (cells[c0].lit >= 0 && t >= cells[c0].lit && cells[c0].burn < 0) litCount++;
		if (litCount) {
			var glow = (litCount / cells.length) * (0.85 + 0.15 * Math.sin(t * 7));
			var cx = ox + (cols * size) / 2, cy = oy + (rows * size) / 2;
			var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cols * size * 0.7);
			grad.addColorStop(0, css(GOLD, 0.16 * glow));
			grad.addColorStop(1, css(GOLD, 0));
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, W, H);
		}

		// la cometa accende le colonne che passa
		var comet = cometAt(t);
		if (comet.p >= 0 && leaveAt < 0) {
			for (var i = 0; i < cells.length; i++) {
				var cell = cells[i];
				if (cell.lit >= 0) continue;
				var x = ox + cell.gx * size;
				if (comet.x >= x) {
					var y = oy + cell.gy * size;
					cell.lit = t + Math.abs(y - comet.y) / (H * 2.2);
					if (Math.random() < 0.12) {
						particles.push({ x: x + size / 2, y: y, vx: rand(-40, 60), vy: rand(-160, -40), life: rand(0.4, 0.8), age: 0,
							s: Math.max(1, size * 0.25), from: FLARE, to: GOLD, g: 260, glow: true });
					}
				}
			}
		}

		// i cubetti
		for (var k = 0; k < cells.length; k++) {
			var ce = cells[k];
			if (ce.gone) continue;
			var fall = easeBack((t - ce.delay) / FALL);
			if (t < ce.delay) continue;
			var px = ox + (ce.gx + ce.fromX * (1 - fall)) * size;
			var py = oy + (ce.gy + ce.fromY * (1 - fall)) * size;
			var shrink = 1;
			if (ce.burn >= 0 && t >= ce.burn) {
				var b = (t - ce.burn) / BURN;
				if (b < 0.6 && Math.random() < 0.06) {  // le fiamme
					particles.push({ x: px + rand(0, size), y: py, vx: rand(-15, 15), vy: rand(-120, -50), life: rand(0.3, 0.6), age: 0,
						s: Math.max(1, size * rand(0.2, 0.45)), from: [255, 214, 110], to: RED, g: -40, glow: true });
				}
				if (b >= 1) {  // si sbriciola in cenere
					ce.gone = true;
					for (var a = 0; a < 3; a++) {
						particles.push({ x: px + rand(0, size), y: py + rand(0, size), vx: rand(10, 70), vy: rand(-70, -15), life: rand(0.8, ASH),
							age: 0, s: Math.max(1, size * rand(0.2, 0.42)), from: ASH_GREY, to: [40, 36, 34], g: -10, glow: false, spin: true });
					}
					continue;
				}
				shrink = b > 0.75 ? 1 - (b - 0.75) * 1.2 : 1;
			}
			var alpha = Math.min(1, (t - ce.delay) / (FALL * 0.4));
			var spr = sprite(colorOf(ce, t));
			var w = (size + depth) * shrink;
			ctx.globalAlpha = alpha;
			ctx.drawImage(spr, Math.round(px + (size + depth) * (1 - shrink) / 2), Math.round(py - depth + (size + depth) * (1 - shrink)), w, w);
		}
		ctx.globalAlpha = 1;

		drawComet(t);

		// scintille, fiamme e cenere
		var alive = [];
		for (var p = 0; p < particles.length; p++) {
			var q = particles[p];
			q.age += dt;
			if (q.age >= q.life) continue;
			q.vy += q.g * dt;
			q.x += q.vx * dt;
			q.y += q.vy * dt;
			var life = q.age / q.life;
			ctx.globalCompositeOperation = q.glow ? "lighter" : "source-over";
			ctx.fillStyle = css(mix(q.from, q.to, life), 1 - life);
			var sz = q.s * (q.spin ? 1 : 1 - life * 0.5);
			ctx.fillRect(Math.round(q.x), Math.round(q.y), sz, sz);
			alive.push(q);
		}
		particles = alive;
		ctx.globalCompositeOperation = "source-over";

		// quando la cometa è passata il titolo è pronto: la frase e "premi un tasto"
		if (!ready && t > COMET_AT + COMET_TIME + 0.2) {
			ready = true;
			splash.classList.add("ready");
		}
		if (leaveAt < 0 && t > COMET_AT + COMET_TIME + HOLD) leave();
		if (leaveAt >= 0 && t > leaveAt + 0.9) splash.classList.add("clear");
		var burnt = leaveAt >= 0 && t > leaveAt + 1.0 + BURN && !particles.length;
		if (burnt || t > MAX_TIME || (leaveAt >= 0 && t > leaveAt + 4)) finish();
	}

	// Comincia a bruciare dal basso, con un fronte che ondeggia
	function leave() {
		if (leaveAt >= 0 || done) return;
		if (!cells.length) { finish(); return; }  // il titolo non c'è ancora: niente da bruciare
		var t = performance.now() / 1000 - start;
		leaveAt = t;
		splash.classList.add("leaving");
		try { sessionStorage.setItem("runess-splash", "1"); } catch (e) {}
		for (var i = 0; i < cells.length; i++) {
			var c = cells[i];
			if (c.delay > t) c.delay = t - FALL;  // chi non era ancora caduto è subito al suo posto
			var front = ((rows - 1 - c.gy) / Math.max(1, rows - 1)) * 0.7 + 0.1 * Math.sin(c.gx * 0.45) + rand(0, 0.2);
			c.burn = t + 0.05 + Math.max(0, front);
		}
	}

	function finish() {
		if (done) return;
		done = true;
		cancelAnimationFrame(frame);
		removeListeners();
		try { sessionStorage.setItem("runess-splash", "1"); } catch (e) {}
		root.classList.remove("splash-on");
		splash.remove();
	}

	var events = ["keydown", "pointerdown", "wheel", "touchstart"];
	function onInput() { leave(); }
	function removeListeners() {
		events.forEach(function (e) { window.removeEventListener(e, onInput); });
		window.removeEventListener("resize", layout);
	}
	events.forEach(function (e) { window.addEventListener(e, onInput, { passive: true }); });
	window.addEventListener("resize", layout);

	function begin(shape) {
		build(shape || fromGlyphs());
		start = performance.now() / 1000;
		draw.last = 0;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(draw);
	}

	try {
		layout();
		start = performance.now() / 1000;
		frame = requestAnimationFrame(draw);  // intanto il pulviscolo
		var settled = false;
		var go = function () {
			if (settled || done) return;
			settled = true;
			var shape = null;
			try { shape = fromFont(); } catch (e) {}
			begin(shape);
		};
		if (document.fonts && document.fonts.load) {
			document.fonts.load(FONT).then(go, go);
			setTimeout(go, 1500);  // il font tarda: si parte con le lettere a quadretti
		} else {
			go();
		}
	} catch (e) {
		finish();
	}
})();
