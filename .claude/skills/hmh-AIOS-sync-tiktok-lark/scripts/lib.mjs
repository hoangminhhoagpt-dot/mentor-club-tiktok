/**
 * hmh-AIOS-sync-tiktok-lark — thư viện dùng chung
 * Config loader + TikTok Display API OAuth + Lark Base helpers.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG = path.join(__dirname, "config.local.json");
export const TT_OPEN = "https://open.tiktokapis.com"; // Display API v2

export function loadConfig(configPath = DEFAULT_CONFIG) {
  let CFG = {};
  try { CFG = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { /* dùng ENV */ }
  const E = process.env;
  CFG.__path        = configPath;
  CFG.larkDomain    = E.LARK_DOMAIN        || CFG.larkDomain || "https://open.larksuite.com";
  CFG.larkAppId     = E.LARK_APP_ID        || CFG.larkAppId;
  CFG.larkAppSecret = E.LARK_APP_SECRET    || CFG.larkAppSecret;
  CFG.appToken      = E.LARK_BASE_ID       || CFG.appToken;
  CFG.tableTiktok   = E.TABLE_TIKTOK       || CFG.tableTiktok;
  CFG.tableProfile  = E.TABLE_PROFILE      || CFG.tableProfile;
  CFG.tablePost     = E.TABLE_POST         || CFG.tablePost;   // dùng bởi setup-tables/check-setup
  CFG.clientKey     = E.TIKTOK_CLIENT_KEY  || CFG.clientKey;
  CFG.clientSecret  = E.TIKTOK_CLIENT_SECRET || CFG.clientSecret;
  CFG.redirectUri   = E.TIKTOK_REDIRECT_URI || CFG.redirectUri;
  CFG.refreshToken  = E.TIKTOK_REFRESH_TOKEN || CFG.refreshToken;
  CFG.accessToken   = E.TIKTOK_ACCESS_TOKEN  || CFG.accessToken;
  return CFG;
}

export function requireKeys(CFG, keys) {
  for (const k of keys) {
    if (!CFG[k]) { console.error(`Thiếu cấu hình "${k}" (điền config.local.json hoặc set biến môi trường).`); process.exit(1); }
  }
}

/** Ghi 1 vài khoá vào config.local.json (giữ nguyên phần còn lại). */
export function patchConfig(patch, configPath = DEFAULT_CONFIG) {
  let obj = {};
  try { obj = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch {}
  Object.assign(obj, patch);
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2) + "\n");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const num = (v) => (v == null || v === "" ? undefined : Number(v));

// ---------- PKCE (Login Kit Desktop bắt buộc; Web cũng chấp nhận) ----------
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function makePkce() {
  const verifier = b64url(crypto.randomBytes(48));           // 43–128 ký tự
  // TikTok lệch chuẩn RFC 7636: code_challenge là SHA-256 dạng HEX, không phải base64url.
  const challenge = crypto.createHash("sha256").update(verifier).digest("hex");
  return { verifier, challenge };
}

// ---------- TikTok OAuth (Display API v2) ----------
// Xin TRỌN scope cho cả 2 chiều trong 1 lần ủy quyền (đỡ phải làm lại):
//   user.info.basic/profile/stats -> bảng 15.3 Profile (follower, like, video, bio, avatar)
//   video.list                    -> bảng 15.1 số liệu video
//   video.upload                  -> bảng 15.2 đăng video lên hộp thư TikTok
// Scope nào chưa bật trong app TikTok thì TikTok chỉ đơn giản không cấp — script tự dò và bỏ qua.
// Gộp đủ scope cho CẢ 2 skill TikTok (sync + đăng) vì dùng CHUNG 1 refresh token:
// video.list (đọc số liệu) + video.upload (đẩy hộp thư) + video.publish (Direct Post kèm caption).
export const FULL_SCOPE = "user.info.basic,user.info.profile,user.info.stats,video.list,video.upload,video.publish";

export function authorizeUrl(CFG, { codeChallenge, scope = FULL_SCOPE, state = "hmh" } = {}) {
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", CFG.clientKey);
  u.searchParams.set("scope", scope);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", CFG.redirectUri);
  u.searchParams.set("state", state);
  if (codeChallenge) {
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

async function ttTokenRequest(form) {
  const r = await fetch(`${TT_OPEN}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams(form),
  });
  const j = await r.json();
  if (j.error && j.error !== "" && j.access_token == null) {
    throw new Error(`TikTok OAuth lỗi: ${j.error} — ${j.error_description || ""}`);
  }
  return j; // { access_token, expires_in, refresh_token, refresh_expires_in, open_id, scope, token_type }
}

/** Đổi authorization code -> tokens (lấy refresh_token dài hạn). */
export function exchangeCode(CFG, code, codeVerifier) {
  const form = {
    client_key: CFG.clientKey, client_secret: CFG.clientSecret,
    code, grant_type: "authorization_code", redirect_uri: CFG.redirectUri,
  };
  if (codeVerifier) form.code_verifier = codeVerifier;
  return ttTokenRequest(form);
}

/** Refresh access_token từ refresh_token. */
export function refreshAccessToken(CFG) {
  return ttTokenRequest({
    client_key: CFG.clientKey, client_secret: CFG.clientSecret,
    grant_type: "refresh_token", refresh_token: CFG.refreshToken,
  });
}

/** Trả access_token còn hạn: ưu tiên refreshToken (mint mới); nếu chỉ có accessToken thì dùng thẳng. */
let _at = null, _atExp = 0, _scope = "";
/** Scope thực tế TikTok đã cấp (biết sau lần refresh đầu). */
export async function getScopes(CFG) { await getAccessToken(CFG); return _scope; }
export async function getAccessToken(CFG) {
  if (_at && Date.now() < _atExp) return _at;
  if (CFG.refreshToken) {
    requireKeys(CFG, ["clientKey", "clientSecret", "refreshToken"]);
    const j = await refreshAccessToken(CFG);
    _at = j.access_token;
    _scope = j.scope || "";
    _atExp = Date.now() + ((j.expires_in || 86400) - 120) * 1000;
    // TikTok xoay refresh_token mỗi lần refresh -> lưu lại cái mới
    if (j.refresh_token && j.refresh_token !== CFG.refreshToken) {
      CFG.refreshToken = j.refresh_token;
      try { patchConfig({ refreshToken: j.refresh_token }, CFG.__path); } catch {}
    }
    return _at;
  }
  if (CFG.accessToken) { _at = CFG.accessToken; _atExp = Date.now() + 3600 * 1000; return _at; }
  console.error('Thiếu "refreshToken" (khuyên dùng) hoặc "accessToken". Chạy get-tiktok-token.mjs để lấy.');
  process.exit(1);
}

// ---------- TikTok Display API: user/info (PROFILE) ----------
// TikTok cấp field theo SCOPE — xin field ngoài scope sẽ lỗi cả request.
// Nên ta chỉ xin đúng field mà token thực sự được cấp:
//   user.info.basic   -> open_id, union_id, avatar_url, display_name
//   user.info.profile -> username, bio_description, profile_deep_link, is_verified
//   user.info.stats   -> follower_count, following_count, likes_count, video_count
const USER_FIELDS_BY_SCOPE = {
  "user.info.basic":   ["open_id", "union_id", "avatar_large_url", "display_name"],
  "user.info.profile": ["username", "bio_description", "profile_deep_link", "is_verified"],
  "user.info.stats":   ["follower_count", "following_count", "likes_count", "video_count"],
};

export async function getUserInfo(CFG) {
  const at = await getAccessToken(CFG);
  const scopes = await getScopes(CFG);
  const fields = [];
  for (const [scope, fs_] of Object.entries(USER_FIELDS_BY_SCOPE)) {
    if (scopes.includes(scope)) fields.push(...fs_);
  }
  if (!fields.length) throw new Error("Token không có scope user.info.* nào — không lấy được profile.");

  const r = await fetch(`${TT_OPEN}/v2/user/info/?fields=${fields.join(",")}`, {
    headers: { Authorization: `Bearer ${at}` },
  });
  const j = await r.json();
  const err = j.error || {};
  if (err.code && err.code !== "ok") {
    throw new Error(`TikTok user/info lỗi: ${err.code} — ${err.message || ""} (log_id ${err.log_id || "?"})`);
  }
  return { user: j.data?.user || {}, scopes, missing: Object.keys(USER_FIELDS_BY_SCOPE).filter((s) => !scopes.includes(s)) };
}

// ---------- TikTok Display API: video/list ----------
const VIDEO_FIELDS = [
  "id", "title", "video_description", "cover_image_url", "share_url", "embed_link",
  "duration", "create_time", "like_count", "comment_count", "share_count", "view_count",
];

export async function listVideosPage(CFG, cursor) {
  const at = await getAccessToken(CFG);
  const url = `${TT_OPEN}/v2/video/list/?fields=${VIDEO_FIELDS.join(",")}`;
  const body = { max_count: 20 };
  if (cursor != null) body.cursor = cursor;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const err = j.error || {};
    if (err.code === "ok" || err.code === 0 || err.code == null) return j.data || {};
    if (err.code === "rate_limit_exceeded" || r.status === 429 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    throw new Error(`TikTok video/list lỗi: ${err.code} — ${err.message || ""} (log_id ${err.log_id || "?"})`);
  }
  throw new Error("TikTok video/list: hết lượt thử.");
}

export async function listAllVideos(CFG, limit = 0, onPage) {
  const out = [];
  let cursor = undefined;
  do {
    const data = await listVideosPage(CFG, cursor);
    const vids = data.videos || [];
    out.push(...vids);
    if (onPage) onPage(vids.length, out.length);
    cursor = data.has_more ? data.cursor : undefined;
    if (limit && out.length >= limit) break;
    if (cursor != null) await sleep(300);
  } while (cursor != null);
  return limit ? out.slice(0, limit) : out;
}

// ---------- Lark Base ----------
let TOKEN = null, TOKEN_EXP = 0;
export async function larkToken(CFG) {
  if (TOKEN && Date.now() < TOKEN_EXP) return TOKEN;
  const r = await fetch(`${CFG.larkDomain}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: CFG.larkAppId, app_secret: CFG.larkAppSecret }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Lark token lỗi: ${j.code} ${j.msg}`);
  TOKEN = j.tenant_access_token; TOKEN_EXP = Date.now() + (j.expire - 120) * 1000;
  return TOKEN;
}

export async function larkApi(CFG, method, apiPath, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await larkToken(CFG);
    const r = await fetch(`${CFG.larkDomain}${apiPath}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (j.code === 99991663 || j.code === 99991661) { TOKEN = null; continue; }
    if (r.status === 429 || j.code === 1254607 || j.code === 1254045) { await sleep(1200 * (attempt + 1)); continue; }
    throw new Error(`Lark ${apiPath} lỗi: ${j.code} ${j.msg}`);
  }
  throw new Error(`Lark ${apiPath}: hết lượt thử.`);
}

/** Revision của Base — cần cho "extra" khi Base bật quyền nâng cao. */
let APP_REV;
async function appRevision(CFG) {
  if (APP_REV !== undefined) return APP_REV;
  try {
    const d = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}`);
    APP_REV = d.app?.revision ?? null;
  } catch { APP_REV = null; }
  return APP_REV;
}

/**
 * Tải ảnh từ URL rồi upload lên Lark drive → file_token.
 * Base BẬT QUYỀN NÂNG CAO thì upload_all cần kèm "extra" (bitablePerm) mới ghi được media,
 * nên thử cách thường trước, hỏng thì thử lại kèm extra=bitablePerm.rev (cần tableId của
 * bảng chứa cột ảnh: video→tableTiktok, avatar→tableProfile).
 */
export async function uploadThumb(CFG, imgUrl, fileName, tableId) {
  const ir = await fetch(imgUrl);
  if (!ir.ok) throw new Error(`Tải thumbnail lỗi ${ir.status}`);
  const buf = Buffer.from(await ir.arrayBuffer());

  const attempts = [null];
  const rev = await appRevision(CFG);
  if (tableId && rev != null) attempts.push(JSON.stringify({ bitablePerm: { tableId, rev } }));

  let last = "";
  for (const extra of attempts) {
    const token = await larkToken(CFG);
    const form = new FormData();
    form.append("file_name", fileName);
    form.append("parent_type", "bitable_image");
    form.append("parent_node", CFG.appToken);
    form.append("size", String(buf.length));
    if (extra) form.append("extra", extra);
    form.append("file", new Blob([buf]), fileName);
    const r = await fetch(`${CFG.larkDomain}/open-apis/drive/v1/medias/upload_all`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const j = await r.json();
    if (j.code === 0) {
      if (extra) console.log(`  (upload ảnh qua extra=bitablePerm — Base đang bật quyền nâng cao)`);
      return j.data.file_token;
    }
    last = `${j.code} ${j.msg}`;
  }
  throw new Error(`Upload media lỗi: ${last}`);
}

export async function listAllRecords(CFG, tableId) {
  const out = []; let pageToken = null;
  do {
    const qs = new URLSearchParams({ page_size: "500" });
    if (pageToken) qs.set("page_token", pageToken);
    const data = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${tableId}/records?${qs}`);
    out.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : null;
  } while (pageToken);
  return out;
}

export const createRecord = (CFG, tableId, fields) =>
  larkApi(CFG, "POST", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${tableId}/records`, { fields });
export const updateRecord = (CFG, tableId, recordId, fields) =>
  larkApi(CFG, "PUT", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${tableId}/records/${recordId}`, { fields });
