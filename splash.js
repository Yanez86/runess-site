// L'apertura della pagina principale: la prima volta in una sessione (la classe intro, che mette lo script in cima
// alla pagina, mai a chi chiede meno movimento) una cometa attraversa la costellazione della corona e ne accende le
// stelle una alla volta, le righe le uniscono, sale il titolo e poi arriva il resto della pagina. Le animazioni sono
// in style.css (.intro); qui solo quando finisce: da sola, o subito con un clic, un tasto, la rotella o un dito.
(function () {
	"use strict";
	var root = document.documentElement;
	if (!root.classList.contains("intro")) return;
	var LENGTH = 4600;  // millisecondi: fino a quando la pagina è comparsa tutta
	var EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"];
	var done = false;

	function end() {
		if (done) return;
		done = true;
		root.classList.remove("intro");  // senza .intro tutto è già al suo posto
		try { sessionStorage.setItem("runess-intro", "1"); } catch (e) {}
		EVENTS.forEach(function (name) { removeEventListener(name, end); });
	}

	setTimeout(end, LENGTH);
	EVENTS.forEach(function (name) { addEventListener(name, end, { passive: true }); });
})();
