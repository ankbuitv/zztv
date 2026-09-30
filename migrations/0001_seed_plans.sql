-- ===========================================================================
-- 0001_seed_plans - default subscription tiers
--
-- INSERT OR IGNORE, so this is safe on a database that already has these rows
-- and it is not the thing that wipes anything. The Worker still runs the same
-- INSERTs from ensureSchema() on every cold start; this migration exists so a
-- freshly migrated database is usable before the Worker has ever served a
-- request (and so `wrangler d1 migrations apply` on a new D1 is enough to get
-- a working install).
-- ===========================================================================

INSERT OR IGNORE INTO plans (code, name, rank, price, price_text, tagline, allows, color)
VALUES ('standard', 'STANDARD', 1, 0, 'TẠM FREE', 'Các kênh VTV',
        '["Các kênh VTV (VTV1, VTV2, VTV3...)","Shorts xem miễn phí mọi gói"]', '#42a5f5');

INSERT OR IGNORE INTO plans (code, name, rank, price, price_text, tagline, allows, color)
VALUES ('recreational', 'RECREATIONAL', 2, 0, 'TẠM FREE', 'VTV + BOX Giải trí',
        '["Toàn bộ gói Standard","38 kênh BOX - Giải trí"]', '#ab47bc');

INSERT OR IGNORE INTO plans (code, name, rank, price, price_text, tagline, allows, color)
VALUES ('ultimate', 'ULTIMATE', 3, 0, 'TẠM FREE', 'VTV + BOX + Thể thao',
        '["Toàn bộ gói Recreational","19 kênh SPORTS - Thể thao"]', '#22c55e');

INSERT OR IGNORE INTO plans (code, name, rank, price, price_text, tagline, allows, color)
VALUES ('elite', 'ELITE', 4, 0, 'TẠM FREE', 'Thêm kênh Phim',
        '["Toàn bộ gói Ultimate","Các kênh Phim (phim / movie)"]', '#f59e0b');

INSERT OR IGNORE INTO plans (code, name, rank, price, price_text, tagline, allows, color)
VALUES ('signature', 'SIGNATURE', 5, 0, 'TẠM FREE', 'Tất cả mọi kênh',
        '["Toàn bộ gói Elite","Tất cả kênh hiện tại & tương lai","Ưu tiên hỗ trợ 24/7"]', '#f36f21');
