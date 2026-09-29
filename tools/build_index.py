"""Construit index.html (version autonome) à partir de la page de l'artifact."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path("/home/claude/geoprompt/geoprompt-studio.html").read_text()
adapter = (ROOT / "tools" / "src_adapter.js").read_text()

style = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
body = src.split("</style>", 1)[1]
body_html, script = body.split("<script>", 1)
script = script.rsplit("</script>", 1)[0]

# 1. Couche de données
a = script.index("/* ---------- Base de données ---------- */")
b = script.index("/* ---------- Navigation ---------- */")
script = script[:a] + adapter + "\n" + script[b:]
# 2. Téléchargements natifs
script = re.sub(r"async function dl\(name,data\)\{.*?\n",
    'async function dl(name,data){const u=URL.createObjectURL(new Blob([data],{type:name.endsWith(".html")?"text/html":"text/markdown"}));const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}\n', script, count=1)
# 3. Textes propres à la version Claude
script = script.replace("La rédaction automatique demande l'autorisation d'utiliser Claude depuis cette page. Le canevas reste disponible.",
                        "La rédaction automatique par Claude est disponible dans la version Claude de l'application. Ici, partez du canevas et complétez-le.")
# 4. Micro (si le navigateur le permet), déconnexion, service worker
script += r"""
window.initMic=function(){const m=document.querySelector("#modal-root .modal");
  if(m&&!m.querySelector("#logout-btn")){const lo=document.createElement("button");lo.type="button";lo.id="logout-btn";lo.className="btn ghost small";lo.textContent="Se déconnecter";lo.onclick=logout;m.appendChild(lo)}
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;const b=document.getElementById("mic-btn");if(!R||!b)return;b.hidden=false;
  b.onclick=()=>{const r=new R();r.lang="fr-FR";r.interimResults=false;b.classList.add("primary");
    r.onresult=e=>{document.getElementById("quick-input").value=e.results[0][0].transcript;document.getElementById("quick-form").requestSubmit()};
    r.onend=()=>b.classList.remove("primary");r.onerror=()=>{b.classList.remove("primary");toast("Dictée indisponible : utilisez le micro du clavier")};r.start()}};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
"""

body_html = body_html.replace('<button class="btn primary" type="submit">Ajouter</button>',
    '<button class="btn" type="button" id="mic-btn" hidden>🎙 Dicter</button><button class="btn primary" type="submit">Ajouter</button>')
body_html = body_html.replace('<span class="scalebar" aria-hidden="true">',
    '<button class="btn small ghost" type="button" id="logout-btn" style="padding:0;font-size:.75rem">Se déconnecter</button><span class="scalebar" aria-hidden="true">')
title = re.search(r"<title>(.*?)</title>", src).group(1)
links = "\n".join(l for l in src.split("\n") if l.startswith("<link"))

login_css = """
body{margin:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
[hidden]{display:none!important}
img{max-width:100%}
"""

html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="Prompts géomatiques quotidiens, veille, marchés, projets et prospection.">
<meta name="theme-color" content="#0B3D34">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GéoPrompt">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{links}
<style>{style}{login_css}</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="config.js"></script>
</head>
<body>
<div class="login" id="login" hidden>
</div>
<div id="app">
{body_html}
</div>
<script>{script}</script>
</body>
</html>
"""
(ROOT / "index.html").write_text(html)
print("index.html", len(html))
