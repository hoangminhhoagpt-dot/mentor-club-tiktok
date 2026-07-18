#!/usr/bin/env node
/**
 * hmh-AIOS-sync-tiktok-lark
 * Kéo VIDEO của tài khoản TikTok (cá nhân) qua TikTok Display API rồi đồng bộ vào Lark Base "15.1 Data Tiktok".
 *
 * Nguồn : POST https://open.tiktokapis.com/v2/video/list/  (Bearer access_token, fields query)
 * Đích  : bảng 15.1 (upsert theo item_id). Thumbnail cover_image_url -> attachment Lark.
 *
 * ⚠️ Display API chỉ có số CƠ BẢN: views, likes, comments, shares, caption, duration, thumbnail, share/embed url.
 *    Các cột watch-time / impression_sources_* / audience_countries-* KHÔNG có ở tài khoản cá nhân -> để trống.
 *
 * Chạy: node sync-tiktok-lark.mjs [--limit N] [--refresh-thumbs] [--dry] [--config path]
 * Cần token: chạy get-tiktok-token.mjs trước để lấy refreshToken.
 */
import {
  loadConfig, requireKeys, num,
  listAllVideos, listAllRecords, uploadThumb, createRecord, updateRecord,
} from "./lib.mjs";

function parseArgs(argv) {
  const a = { limit: 0, refreshThumbs: false, dry: false, config: undefined };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--limit") a.limit = parseInt(argv[++i], 10) || 0;
    else if (k === "--refresh-thumbs") a.refreshThumbs = true;
    else if (k === "--dry") a.dry = true;
    else if (k === "--config") a.config = argv[++i];
    else if (k === "--help") { console.log("Cờ: --limit N | --refresh-thumbs | --dry | --config path"); process.exit(0); }
  }
  return a;
}
const args = parseArgs(process.argv);
const CFG = loadConfig(args.config);
requireKeys(CFG, ["larkAppId", "larkAppSecret", "appToken", "tableTiktok"]);
const log = (...m) => console.log(...m);

/** 1 video Display API -> fields Lark (chỉ các cột có dữ liệu). */
function mapVideo(v) {
  const f = {
    "item_id": String(v.id ?? ""),
    "caption": v.title || v.video_description || "",
    "video_views": num(v.view_count),
    "likes": num(v.like_count),
    "comments": num(v.comment_count),
    "shares": num(v.share_count),
    "video_duration": num(v.duration),
    "share_url": v.share_url || "",
    "embed_url": v.embed_link || "",
  };
  if (v.create_time != null && v.create_time !== "") {
    const t = Number(v.create_time);
    f["video_create_time"] = t < 1e12 ? t * 1000 : t;
  }
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  return f;
}

async function main() {
  log(`Lark base=${CFG.appToken} table=${CFG.tableTiktok}` +
      `${args.limit ? " | limit=" + args.limit : ""}${args.dry ? " | DRY" : ""}`);

  const videos = await listAllVideos(CFG, args.limit, (n, total) => log(`  TikTok: +${n} video (tổng ${total})`));
  log(`\nTikTok tổng: ${videos.length} video`);
  if (!videos.length) { log("Không có video nào (token/scope video.list?)."); return; }

  if (args.dry) {
    log("== DRY RUN: 1 video mẫu ==");
    log(JSON.stringify(videos[0], null, 2));
    log("== map -> Lark ==");
    log(JSON.stringify(mapVideo(videos[0]), null, 2));
    return;
  }

  const existing = await listAllRecords(CFG, CFG.tableTiktok);
  const byId = new Map();
  for (const r of existing) {
    const raw = r.fields["item_id"];
    const id = Array.isArray(raw) ? raw.map((x) => x.text || x).join("") : raw;
    if (id) byId.set(String(id), r);
  }
  log(`Lark hiện có: ${existing.length} record`);

  let created = 0, updated = 0, i = 0;
  for (const v of videos) {
    i++;
    const fields = mapVideo(v);
    const cur = byId.get(String(v.id));

    const hasThumb = cur?.fields["thumbnail"]?.length;
    if (v.cover_image_url && (args.refreshThumbs || !hasThumb)) {
      try {
        const ft = await uploadThumb(CFG, v.cover_image_url, `${v.id}.jpg`, CFG.tableTiktok);
        fields["thumbnail"] = [{ file_token: ft }];
      } catch (e) { log(`  ! thumb ${v.id} lỗi: ${e.message}`); }
    }

    try {
      if (cur) { await updateRecord(CFG, CFG.tableTiktok, cur.record_id, fields); updated++; }
      else { await createRecord(CFG, CFG.tableTiktok, fields); created++; }
    } catch (e) { log(`  ! ghi ${v.id} lỗi: ${e.message}`); }

    if (i % 20 === 0) log(`  ... ${i}/${videos.length} (tạo ${created}, cập nhật ${updated})`);
  }
  log(`\n✔ XONG: tạo ${created}, cập nhật ${updated}, tổng ${videos.length}.`);
  log("Lưu ý: cột watch-time / impression / audience để trống (Display API không có cho tài khoản cá nhân).");
}
main().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
