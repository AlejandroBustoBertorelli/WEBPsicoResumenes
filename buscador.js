/* buscador.js — Buscador interno de PsicoResúmenes (100% del lado del cliente).
   Coloca un <div id="buscador"></div> donde quieras que aparezca e incluí
   <script src="(ruta a)buscador.js" defer></script>. Usa search-index.json (misma carpeta que este archivo).
   Para regenerar el índice: recrear search-index.json con {u:url, t:título, d:descripción, c:categoría} por página. */
(function () {
  var thisScript = document.currentScript;

  function getBase() {
    var src = thisScript && thisScript.src;
    if (!src) {
      var ss = document.getElementsByTagName('script');
      for (var i = ss.length - 1; i >= 0; i--) {
        if (/buscador\.js(\?|$)/.test(ss[i].src)) { src = ss[i].src; break; }
      }
    }
    return src ? src.replace(/buscador\.js(\?.*)?$/, '') : '';
  }
  var BASE = getBase();

  var CSS = "\
.buscador-psico{max-width:680px;margin:0 auto;font-family:'Varela',Arial,sans-serif;text-align:left;position:relative;z-index:50;}\
.bsc-box{display:flex;border:2px solid #0a3965;border-radius:8px;overflow:hidden;background:#fff;}\
.bsc-input{flex:1;border:0;outline:0;padding:13px 16px;font-size:16px;color:#0a3965;font-family:inherit;background:#fff;min-width:0;}\
.bsc-input::placeholder{color:#7b8ca0;}\
.bsc-icon{display:flex;align-items:center;justify-content:center;width:52px;background:#0a3965;color:#fff;font-size:20px;flex:none;}\
.bsc-results{margin-top:8px;background:#fff;border-radius:8px;box-shadow:0 6px 20px rgba(10,57,101,.18);overflow:hidden;max-height:60vh;overflow-y:auto;}\
.bsc-item{display:block;padding:11px 16px;text-decoration:none;border-bottom:1px solid #eef1f5;color:#0a3965;}\
.bsc-item:last-child{border-bottom:0;}\
.bsc-item:hover,.bsc-item:focus{background:#f0f5fb;}\
.bsc-cat{display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.3px;background:#e5edf6;color:#165da0;padding:2px 8px;border-radius:10px;margin-bottom:4px;font-weight:bold;}\
.bsc-title{display:block;font-weight:bold;font-size:15px;line-height:1.25;color:#0a3965;}\
.bsc-desc{display:block;font-size:13px;color:#5a6b7d;margin-top:2px;line-height:1.35;}\
.bsc-info{padding:9px 16px;font-size:12px;color:#7b8ca0;border-bottom:1px solid #eef1f5;text-transform:uppercase;letter-spacing:.3px;}\
.bsc-empty{padding:14px 16px;color:#5a6b7d;font-size:14px;}\
.bsc-hl{background:#fff3ba;border-radius:2px;}\
";

  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-buscador-psico', '');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  var COMB = /[\u0300-\u036f]/g;
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(COMB, ''); }
  // normaliza preservando la longitud (para resaltar respetando acentos)
  function normLen(s) {
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var n = s[i].toLowerCase().normalize('NFD').replace(COMB, '');
      o += (n.length ? n[0] : s[i]);
    }
    return o;
  }
  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function highlight(text, words) {
    if (!words.length) return escapeHtml(text);
    var nt = normLen(text), marks = new Array(text.length);
    for (var w = 0; w < words.length; w++) {
      var word = words[w]; if (!word) continue;
      var from = 0, pos;
      while ((pos = nt.indexOf(word, from)) >= 0) {
        for (var k = pos; k < pos + word.length; k++) marks[k] = true;
        from = pos + word.length;
      }
    }
    var out = '', open = false;
    for (var i = 0; i < text.length; i++) {
      if (marks[i] && !open) { out += '<span class="bsc-hl">'; open = true; }
      else if (!marks[i] && open) { out += '</span>'; open = false; }
      out += escapeHtml(text[i]);
    }
    if (open) out += '</span>';
    return out;
  }

  function makeSearcher(index) {
    return function (q) {
      var words = norm(q).split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      var nq = norm(q), res = [];
      for (var i = 0; i < index.length; i++) {
        var it = index[i], t = norm(it.t), d = norm(it.d), c = norm(it.c), ok = true, score = 0;
        for (var w = 0; w < words.length; w++) {
          var s = 0, word = words[w];
          if (t.indexOf(word) >= 0) s += 10;
          if ((' ' + t + ' ').indexOf(' ' + word + ' ') >= 0) s += 6;
          if (c.indexOf(word) >= 0) s += 4;
          if (d.indexOf(word) >= 0) s += 3;
          if (s === 0) { ok = false; break; }
          score += s;
        }
        if (ok) { if (t.indexOf(nq) === 0) score += 20; res.push([score, it]); }
      }
      res.sort(function (a, b) { return b[0] - a[0]; });
      return res.slice(0, 15).map(function (r) { return r[1]; });
    };
  }

  function render(slot, index) {
    var search = makeSearcher(index);
    if (slot.className.indexOf('buscador-psico') < 0) slot.className += ' buscador-psico';
    slot.innerHTML =
      '<div class="bsc-box"><input class="bsc-input" type="search" autocomplete="off" ' +
      'placeholder="Buscá resúmenes, materiales, artículos…" aria-label="Buscar en el sitio"/>' +
      '<span class="bsc-icon" aria-hidden="true">&#128269;</span></div>' +
      '<div class="bsc-results" style="display:none"></div>';
    var input = slot.querySelector('.bsc-input');
    var panel = slot.querySelector('.bsc-results');
    var timer;
    function show() {
      var q = input.value.trim();
      if (q.length < 2) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
      var words = norm(q).split(/\s+/).filter(Boolean);
      var out = search(q), html;
      if (!out.length) {
        html = '<div class="bsc-empty">No se encontraron resultados para <strong>' + escapeHtml(q) + '</strong>.</div>';
      } else {
        html = '<div class="bsc-info">' + out.length + ' resultado' + (out.length > 1 ? 's' : '') + '</div>';
        for (var i = 0; i < out.length; i++) {
          var it = out[i];
          html += '<a class="bsc-item" href="' + BASE + it.u + '">' +
            '<span class="bsc-cat">' + escapeHtml(it.c) + '</span>' +
            '<span class="bsc-title">' + highlight(it.t, words) + '</span>' +
            (it.d ? '<span class="bsc-desc">' + highlight(it.d, words) + '</span>' : '') +
            '</a>';
        }
      }
      panel.innerHTML = html;
      panel.style.display = 'block';
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(show, 110); });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) show(); });
    document.addEventListener('click', function (e) { if (!slot.contains(e.target)) panel.style.display = 'none'; });
  }

  function init() {
    var slots = document.querySelectorAll('#buscador, .buscador-psico-slot');
    if (!slots.length) return;
    fetch(BASE + 'search-index.json').then(function (r) { return r.json(); }).then(function (index) {
      for (var i = 0; i < slots.length; i++) render(slots[i], index);
    }).catch(function () { for (var i = 0; i < slots.length; i++) slots[i].innerHTML = ''; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
