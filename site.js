// Il sito di Runess (tools/site/game_site.gd): il menu sul telefono, la lingua scelta, le sezioni che compaiono
// scorrendo, gli screenshot ingranditi, il trailer, e nella pagina delle novità la ricerca e l'indice delle versioni.
// Senza librerie; tutto funziona anche senza, solo più fermo.
(function () {
	"use strict";
	var doc = document;
	var list = function (selector, from) { return Array.prototype.slice.call((from || doc).querySelectorAll(selector)); };
	var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

	// Il cielo: stelline quadrate, sempre le stesse (un generatore col suo seme), che brillano piano
	var sky = doc.querySelector(".sky");
	if (sky && sky.getContext) {
		var g = sky.getContext("2d");
		var seed = 7;
		var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
		var stars = [];
		for (var s = 0; s < 240; s++) stars.push({ x: rnd(), y: rnd(), big: rnd() < 0.14, phase: rnd() * 6.28, speed: 0.5 + rnd() * 1.5 });
		var fit = function () {
			var dpr = Math.min(window.devicePixelRatio || 1, 2);
			sky.width = Math.round(innerWidth * dpr);
			sky.height = Math.round(innerHeight * dpr);
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		var paint = function (t) {
			g.clearRect(0, 0, innerWidth, innerHeight);
			for (var i = 0; i < stars.length; i++) {
				var star = stars[i];
				var a = calm ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * star.speed + star.phase));
				var size = star.big ? 3 : 2;
				g.fillStyle = "rgba(255, " + (star.big ? 236 : 226) + ", 200, " + a.toFixed(3) + ")";
				g.fillRect(Math.round(star.x * innerWidth), Math.round(star.y * innerHeight), size, size);
			}
			if (!calm) requestAnimationFrame(paint);
		};
		fit();
		addEventListener("resize", function () { fit(); if (calm) paint(0); });
		requestAnimationFrame(paint);
	}

	// Come si gioca: le righe d'oro fra le schede, come le stelle di una costellazione
	var map = doc.querySelector(".map");
	if (map) {
		var links = map.querySelector(".links");
		var drawLinks = function () {
			var box = map.getBoundingClientRect();
			var cards = list(".card", map).map(function (card) {
				var r = card.getBoundingClientRect();
				return [r.left - box.left + r.width / 2, r.top - box.top];
			});
			var order = [0, 1, 2, 5, 4, 3, 0];  // in giro: la prima fila, poi la seconda al contrario
			var lines = "";
			for (var k = 1; k < order.length && cards.length >= 6; k++) {
				var a = cards[order[k - 1]], b = cards[order[k]];
				lines += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
			}
			links.innerHTML = lines;
		};
		drawLinks();
		addEventListener("resize", drawLinks);
		addEventListener("load", drawLinks);
		if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(drawLinks);
	}

	// Il menu sul telefono
	var toggle = doc.querySelector(".menu-toggle");
	var nav = doc.getElementById("nav");
	if (toggle && nav) {
		var setOpen = function (open) {
			nav.classList.toggle("open", open);
			toggle.setAttribute("aria-expanded", open ? "true" : "false");
		};
		toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
		nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
		doc.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
	}

	// La lingua scelta a mano resta: la pagina inglese non riporta più a quella italiana
	list("a[data-lang]").forEach(function (a) {
		a.addEventListener("click", function () {
			try { localStorage.setItem("runess-lang", a.getAttribute("data-lang")); } catch (e) {}
		});
	});

	// Le sezioni che compaiono scorrendo
	var reveals = list(".reveal");
	if ("IntersectionObserver" in window) {
		var shown = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				entry.target.classList.add("in");
				shown.unobserve(entry.target);
			});
		}, { rootMargin: "0px 0px -6% 0px" });
		reveals.forEach(function (el) { shown.observe(el); });
	} else {
		reveals.forEach(function (el) { el.classList.add("in"); });
	}

	// «Guarda il trailer»: scende al video e lo fa partire
	var video = doc.querySelector("#trailer video");
	list("a[href='#trailer']").forEach(function (a) {
		a.addEventListener("click", function () {
			if (!video) return;
			setTimeout(function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); }, 450);
		});
	});

	// Gli screenshot ingranditi, con le frecce, la tastiera e lo strisciare del dito
	var box = doc.getElementById("lightbox");
	var shots = list(".shot a");
	if (box && shots.length && box.showModal) {
		var img = box.querySelector("img");
		var caption = box.querySelector("figcaption");
		var index = 0;
		var show = function (i) {
			index = (i + shots.length) % shots.length;
			var link = shots[index];
			img.src = link.href;
			img.alt = link.querySelector("img").alt;
			caption.textContent = link.parentNode.querySelector("figcaption").textContent;
		};
		shots.forEach(function (link, i) {
			link.addEventListener("click", function (e) {
				e.preventDefault();
				show(i);
				box.showModal();
			});
		});
		box.querySelector(".lb-close").addEventListener("click", function () { box.close(); });
		box.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
		box.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
		box.addEventListener("click", function (e) { if (e.target === box || e.target.tagName === "FIGURE") box.close(); });
		box.addEventListener("keydown", function (e) {
			if (e.key === "ArrowLeft") show(index - 1);
			else if (e.key === "ArrowRight") show(index + 1);
		});
		var touchX = null;
		box.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
		box.addEventListener("touchend", function (e) {
			if (touchX === null) return;
			var dx = e.changedTouches[0].clientX - touchX;
			if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
			touchX = null;
		});
	}

	// Le novità: ricerca, apri e chiudi tutte, l'indice che segue la versione che leggi
	var releases = list(".release");
	if (releases.length) {
		var filter = doc.getElementById("cl-filter");
		var none = doc.querySelector(".cl-none");
		var links = {};
		list(".cl-index a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
		var plain = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
		var startOpen = releases.map(function (r) { return r.open; });
		var items = releases.map(function (r) {
			return {
				el: r,
				head: plain(r.querySelector("summary").textContent),
				notes: list(".rel-notes li", r).map(function (li) { return { el: li, text: plain(li.textContent) }; })
			};
		});
		var applyFilter = function () {
			var words = plain(filter.value.trim()).split(/\s+/).filter(Boolean);
			var any = false;
			items.forEach(function (item, i) {
				var matches = 0;
				item.notes.forEach(function (note) {
					var ok = words.every(function (w) { return note.text.indexOf(w) >= 0 || item.head.indexOf(w) >= 0; });
					note.el.classList.toggle("hidden", !ok);
					if (ok) matches++;
				});
				// una parte (Nuove parti, Aggiunte…) senza righe rimaste sparisce col suo titolo
				list(".rel-notes", item.el).forEach(function (ul) {
					var empty = words.length > 0 && !ul.querySelector("li:not(.hidden)");
					ul.classList.toggle("hidden", empty);
					var title = ul.previousElementSibling;
					if (title && title.classList.contains("rel-part")) title.classList.toggle("hidden", empty);
				});
				var hide = words.length > 0 && matches === 0;
				item.el.classList.toggle("hidden", hide);
				var link = links[item.el.id];
				if (link) link.parentNode.classList.toggle("hidden", hide);
				item.el.open = words.length ? !hide : startOpen[i];
				if (!hide) any = true;
			});
			none.hidden = any;
		};
		if (filter) filter.addEventListener("input", applyFilter);
		var setAll = function (open) { releases.forEach(function (r) { if (!r.classList.contains("hidden")) r.open = open; }); };
		var expand = doc.getElementById("cl-expand");
		var collapse = doc.getElementById("cl-collapse");
		if (expand) expand.addEventListener("click", function () { setAll(true); });
		if (collapse) collapse.addEventListener("click", function () { setAll(false); });

		// una versione dall'indirizzo (#v0-12-1) o dall'indice si apre
		var openTarget = function () {
			var target = location.hash && doc.getElementById(location.hash.slice(1));
			if (target && target.tagName === "DETAILS") target.open = true;
		};
		window.addEventListener("hashchange", openTarget);
		openTarget();

		var current = null;
		var keepVisible = function (link) {
			var ol = link.closest("ol");
			var aside = link.closest(".cl-index");
			if (getComputedStyle(ol).display === "flex") {
				ol.scrollTo({ left: link.parentNode.offsetLeft - ol.offsetLeft - ol.clientWidth / 2 + link.clientWidth / 2 });
			} else if (aside.scrollHeight > aside.clientHeight) {
				aside.scrollTo({ top: link.parentNode.offsetTop - aside.clientHeight / 2 });
			}
		};
		var mark = function (id) {
			var link = links[id];
			if (!link || link === current) return;
			if (current) current.classList.remove("current");
			link.classList.add("current");
			current = link;
			keepVisible(link);
		};
		if ("IntersectionObserver" in window) {
			var spy = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) { if (entry.isIntersecting) mark(entry.target.id); });
			}, { rootMargin: "-90px 0px -65% 0px" });
			releases.forEach(function (r) { spy.observe(r); });
		}
	}

	// «Torna su»
	var up = doc.querySelector(".to-top");
	if (up) {
		var onScroll = function () { up.classList.toggle("show", window.scrollY > 700); };
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
	}
})();
