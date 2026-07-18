#!/usr/bin/env node
/**
 * Đăng video từ Lark Base "15.2 Đăng video TikTok" -> HỘP THƯ/NHÁP TikTok
 * (Content Posting API, luồng Upload to Inbox — scope video.upload, KHÔNG cần app audit).
 * Ghi kết quả ngược lại bảng: Publish ID, Trạng thái TikTok, Ngày đẩy, Trạng thái.
 * Chủ kênh mở app TikTok → thông báo/nháp → dán caption → bấm Đăng.
 *
 * ĐĂNG THEO NÚT BẤM (KHÔNG phụ thuộc trạng thái "Chờ đăng"):
 *   • --record-id recXXX  (hoặc biến môi trường RECORD_ID)
 *       → đăng ĐÚNG dòng đó, BẤT KỂ Trạng thái. Đây là chế độ Lark Automation gọi khi
 *         người dùng tick ô "Đăng ngay" trên một dòng.
 *   • không truyền record-id
 *       → quét bảng, đăng các dòng CÓ TICK "Đăng ngay" và CHƯA có Publish ID.
 *
 * Chống đăng trùng: dòng đã có Publish ID thì BỎ QUA (trừ khi --force).
 * Đăng xong (kể cả khi lỗi) tự BỎ TICK "Đăng ngay" để automation không lặp vô hạn.
 *
 * Chạy: node post-video-tiktok.mjs [--record-id recXXX] [--limit N] [--dry-run] [--force]
 * Node >= 18, zero-dependency.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadConfig, requireKeys, sleep,
  downloadAttachment, listAllRecords, updateRecord,
  uploadFileToInbox, fetchStatus,
} from "./lib.mjs";

const CFG = loadConfig();
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const LIMIT = parseInt(arg("--limit") || "0", 10) || 0;
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");   // cho phép đẩy lại dòng đã có Publish ID
const RECORD_ID = (arg("--record-id") || process.env.RECORD_ID || "").trim();

const F_TRIGGER = "Đăng ngay";
const txt = (v, d = "") => (v == null ? d : (typeof v === "object" ? (v.text ?? d) : String(v)));
const hasVideo = (r) => Array.isArray(r.fields["Video"]) && r.fields["Video"].length > 0;
const posted = (r) => !!txt(r.fields["Publish ID"]).trim();
const mimeOf = (name) => {
  const e = (name.split(".").pop() || "").toLowerCase();
  return e === "mov" ? "video/quicktime" : e === "webm" ? "video/webm" : "video/mp4";
};

async function main() {
  const need = DRY ? ["tablePost"] : ["tablePost", "clientKey", "clientSecret", "refreshToken"];
  requireKeys(CFG, need);

  const rows = await listAllRecords(CFG, CFG.tablePost);
  let pending;

  if (RECORD_ID) {
    // Nút bấm: đăng đúng 1 dòng, KHÔNG xét Trạng thái. Chỉ cần có file video.
    const row = rows.find((r) => r.record_id === RECORD_ID);
    if (!row)           { console.log(`Không thấy dòng ${RECORD_ID} trong bảng.`); return; }
    if (!hasVideo(row)) { console.log(`Dòng ${RECORD_ID} chưa có file ở cột "Video".`); return; }
    if (posted(row) && !FORCE) {
      console.log(`Dòng ${RECORD_ID} đã đăng rồi (Publish ID=${txt(row.fields["Publish ID"])}). Thêm --force nếu muốn đẩy lại.`);
      return;
    }
    pending = [row];
    console.log(`Nút bấm → đăng 1 dòng: ${RECORD_ID}`);
  } else {
    // Quét bảng: chỉ lấy dòng ĐƯỢC TICK "Đăng ngay" và chưa đăng.
    pending = rows.filter((r) => hasVideo(r) && r.fields[F_TRIGGER] === true && (FORCE || !posted(r)));
    if (LIMIT) pending = pending.slice(0, LIMIT);
    console.log(`Có ${pending.length} dòng tick "${F_TRIGGER}" chờ đẩy${LIMIT ? ` (giới hạn ${LIMIT})` : ""}.`);
  }
  if (!pending.length) return;

  for (const row of pending) {
    const f = row.fields;
    const title = txt(f["Tiêu đề"]).trim() || "Untitled";
    const att = f["Video"][0];
    console.log(`\n▶ "${title}" — file ${att.name} (${(att.size / 1e6).toFixed(1)}MB)`);
    if (DRY) { console.log("  [dry-run] bỏ qua tải & đẩy."); continue; }

    const tmp = path.join(os.tmpdir(), `tt-${row.record_id}-${att.name}`.replace(/[^\w.\-]/g, "_"));
    try {
      await updateRecord(CFG, CFG.tablePost, row.record_id, { "Trạng thái": "Đang đẩy" });
      console.log("  ↓ tải video từ Lark...");
      await downloadAttachment(CFG, att, tmp, { tableId: CFG.tablePost, recordId: row.record_id, fieldName: "Video" });

      console.log("  ↑ đẩy lên hộp thư TikTok...");
      const publishId = await uploadFileToInbox(CFG, tmp, mimeOf(att.name));

      let ttStatus = "PROCESSING_UPLOAD", failReason = "";
      for (let i = 0; i < 8; i++) {
        await sleep(2500);
        const s = await fetchStatus(CFG, publishId);
        ttStatus = s.status || ttStatus;
        failReason = s.fail_reason || "";
        if (ttStatus === "SEND_TO_USER_INBOX" || ttStatus === "FAILED") break;
      }
      if (ttStatus === "FAILED") throw new Error(`TikTok xử lý thất bại: ${failReason || "FAILED"}`);

      await updateRecord(CFG, CFG.tablePost, row.record_id, {
        "Trạng thái": "Đã vào hộp thư",
        "Trạng thái TikTok": ttStatus,
        "Publish ID": publishId,
        "Ngày đẩy": Date.now(),
        "Ghi chú lỗi": "",
        [F_TRIGGER]: false,          // bỏ tick -> automation không kích hoạt lại
      });
      console.log(`  ✔ Đã vào hộp thư TikTok (publish_id=${publishId}).`);
      console.log("    → Mở app TikTok, vào thông báo/nháp để dán caption & bấm Đăng.");
    } catch (e) {
      console.log(`  ✗ Lỗi: ${e.message}`);
      try {
        await updateRecord(CFG, CFG.tablePost, row.record_id, {
          "Trạng thái": "Lỗi",
          "Ghi chú lỗi": e.message.slice(0, 900),
          [F_TRIGGER]: false,        // bỏ tick kể cả khi lỗi -> tránh lặp vô hạn
        });
      } catch {}
    } finally {
      try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch {}
    }
    await sleep(800);
  }
  console.log("\n✔ Hoàn tất.");
}
main().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
