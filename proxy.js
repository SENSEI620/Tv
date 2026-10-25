// Proxy de vídeo para o Minha TV (Vercel Edge Function).
// Uso: /api/proxy?u=<link codificado>
// - Libera links http dentro do site https
// - Contorna bloqueio de CORS
// - Reescreve listas .m3u8 para que os pedaços do vídeo também passem pelo proxy

// regions: roda o proxy em São Paulo, para canais que só liberam IP do Brasil
export const config = { runtime: "edge", regions: ["gru1"] };

const CORS = {
  "X-Proxy": "1",   // o app usa isso para saber que o proxy está instalado
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, X-Proxy",
};

// Impede que o proxy seja usado para acessar redes internas
function hostProibido(h) {
  h = h.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "[::1]" || h.startsWith("[")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

const prox = u => "/api/proxy?u=" + encodeURIComponent(u);

function reescreverM3U8(texto, base) {
  const resolver = ref => { try { return new URL(ref, base).toString(); } catch (e) { return null; } };
  return texto.split(/\r?\n/).map(linha => {
    const t = linha.trim();
    if (!t) return linha;
    if (t.startsWith("#")) {
      // atributos URI="..." (chaves, legendas, listas de áudio etc.)
      return linha.replace(/URI="([^"]+)"/g, (m, ref) => {
        const abs = resolver(ref);
        return abs ? 'URI="' + prox(abs) + '"' : m;
      });
    }
    const abs = resolver(t);
    return abs ? prox(abs) : linha;
  }).join("\n");
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const alvo = new URL(req.url).searchParams.get("u");
  if (!alvo) return new Response("Falta o parâmetro u", { status: 400, headers: CORS });

  let url;
  try { url = new URL(alvo); } catch (e) { return new Response("Link inválido", { status: 400, headers: CORS }); }
  if (!/^https?:$/.test(url.protocol) || hostProibido(url.hostname))
    return new Response("Link não permitido", { status: 403, headers: CORS });

  const cab = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "*/*",
  });
  const range = req.headers.get("range");
  if (range) cab.set("Range", range);

  let up;
  try {
    up = await fetch(url.toString(), { headers: cab, redirect: "follow", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return new Response("Canal não respondeu", { status: 502, headers: CORS });
  }
  if (!up.ok && up.status !== 206)
    return new Response("Canal respondeu " + up.status, { status: up.status, headers: CORS });

  const tipo = up.headers.get("content-type") || "";
  const pareceM3U8 = /mpegurl/i.test(tipo) || /\.m3u8?(\?|$)/i.test(url.pathname + url.search);

  if (pareceM3U8) {
    const texto = await up.text();
    if (texto.trim().startsWith("#EXTM3U")) {
      return new Response(reescreverM3U8(texto, up.url || url.toString()), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      });
    }
    return new Response(texto, { status: 200, headers: { ...CORS, "Content-Type": tipo || "text/plain" } });
  }

  // Pedaços de vídeo (.ts, .mp4, etc.): repassa direto, sem carregar tudo na memória
  const saida = new Headers(CORS);
  ["content-type", "content-length", "content-range", "accept-ranges"].forEach(h => {
    const v = up.headers.get(h);
    if (v) saida.set(h, v);
  });
  saida.set("Cache-Control", "public, max-age=30");
  return new Response(up.body, { status: up.status, headers: saida });
}
