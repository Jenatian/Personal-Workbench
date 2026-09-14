// Pages Functions 共享工具

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
  'Access-Control-Max-Age': '86400',
};

export const jsonHeaders = Object.assign({}, corsHeaders, {
  'Content-Type': 'application/json; charset=utf-8',
});

export function getUserId(request) {
  const url = new URL(request.url);
  return url.searchParams.get('uid') || request.headers.get('X-User-Id') || 'default';
}

export function stripHtml(html) {
  return (html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&#\d+;/g, function(m) {
      var code = parseInt(m.match(/\d+/)[0]);
      return String.fromCharCode(code);
    })
    .trim();
}

export function extractTag(xml, tag) {
  const regex = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return stripHtml(match[1]);
}

export function parseRSS(xml) {
  const items = [];

  // RSS 2.0: <item> tags
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) || [];
  for (const match of matches) {
    const title = extractTag(match, 'title');
    const link = extractTag(match, 'link');
    const description = extractTag(match, 'description');
    const pubDate = extractTag(match, 'pubDate');
    if (title && link) {
      items.push({ title, link, summary: description, date: pubDate });
    }
  }

  // Atom: <entry> tags (if no RSS items found)
  if (items.length === 0) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    const entryMatches = xml.match(entryRegex) || [];
    for (const match of entryMatches) {
      const title = extractTag(match, 'title');
      // Atom link is in <link href="..." /> attribute
      const linkMatch = match.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
      const link = linkMatch ? linkMatch[1] : '';
      const summary = extractTag(match, 'summary') || extractTag(match, 'content');
      const pubDate = extractTag(match, 'published') || extractTag(match, 'updated');
      if (title && link) {
        items.push({ title, link, summary, date: pubDate });
      }
    }
  }

  return items;
}

export async function translateWithAI(env, text) {
  if (!text || text.length === 0) return text;
  const truncated = text.slice(0, 400);
  try {
    const res = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: truncated,
      source_lang: 'english',
      target_lang: 'chinese',
    });
    if (res && res.translated_text) {
      return res.translated_text;
    }
    return text;
  } catch (e) {
    return text;
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function errorResponse(message, status = 500) {
  return jsonResponse({ ok: false, error: message }, status);
}
