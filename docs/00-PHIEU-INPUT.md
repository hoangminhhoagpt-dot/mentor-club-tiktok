# 00 — PHIẾU INPUT (điền xong là chạy) — TikTok ⇄ Lark

> **Ô I của ITTO**: chuẩn bị TRƯỚC khi bấm chạy. Chi tiết từng bước ở `docs/01→07`.
> Soát hợp đồng: `node check-itto.mjs` · soát cấu hình: `node .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts/check-setup.mjs`.

| # | Việc | Điền / xác nhận | Xong? |
|---|---|---|---|
| 1 | **App Lark** + cấp quyền `bitable:app` + thêm app vào Base — `docs/01` | LARK_APP_ID `cli_…`, LARK_BASE_ID `…` | ☐ |
| 2 | **App TikTok** (client key/secret) — `docs/02` | TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET | ☐ |
| 3 | **3 bảng** (nhân Base Mẫu *hoặc* `setup-tables.mjs`) — `docs/04` | TABLE_TIKTOK/​POST/​PROFILE (`tbl…`) | ☐ |
| 4 | **Refresh token TikTok** — `get-tiktok-token.mjs auth` → `exchange <code>` — `docs/04` | TIKTOK_REFRESH_TOKEN | ☐ |
| 5 | **Nạp GitHub** — 3 Secret + 7 Variable — `docs/05` | ✅ / ❌ | ☐ |
| 6 | **Preflight**: `node check-itto.mjs` (hợp đồng) **và** `check-setup.mjs` (7 mắt xích) → XANH | ✅ / ❌ | ☐ |
| 7 | **Nối nút/lịch** trong Lark (tick "Đăng ngay"; cron 08:00) — `docs/07` | ✅ / ❌ | ☐ |

**Secrets (3):** `LARK_APP_SECRET` · `TIKTOK_CLIENT_SECRET` · `TIKTOK_REFRESH_TOKEN`
**Variables (7):** `LARK_APP_ID` · `LARK_DOMAIN` · `LARK_BASE_ID` · `TABLE_TIKTOK` · `TABLE_POST` · `TABLE_PROFILE` · `TIKTOK_CLIENT_KEY`

**event_type:** `sync-tiktok` (kéo video+profile) · `dang-video-tiktok` (đăng 1 dòng, kèm `record_id`).

> Nhớ: đăng = vào **hộp thư** TikTok, caption dán tay trong app (TikTok chưa cho auto-đăng công khai).
> 1 repo phục vụ nhiều base: truyền `base_id`/`table_*` qua `client_payload` — không sửa code.
