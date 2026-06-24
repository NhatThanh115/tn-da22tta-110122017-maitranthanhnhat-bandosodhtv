-- ============================================================
-- INIT.SQL – TVU Digital Map
-- File tổng hợp để Docker PostgreSQL container tự động chạy
-- khi khởi tạo volume lần đầu tiên.
-- PostgreSQL chỉ chạy file này MỘT LẦN khi volume pgdata chưa tồn tại.
-- Để reset DB: docker compose down -v && docker compose up
-- ============================================================


-- ============================================================
-- PHẦN 1: SCHEMA – Toàn bộ nội dung schema.sql
-- (Tạo extension, bảng, index, function, view)
-- ============================================================

-- Active: 1779293081967@@127.0.0.1@5432@postgres@public
-- ============================================================
-- SCHEMA: TVU Digital Map (Đã Tối Ưu Hóa)
-- Database: PostgreSQL + PostGIS + pgRouting
-- Mô tả: Cơ sở dữ liệu cho hệ thống bản đồ số khuôn viên
--         Đại học Trà Vinh với chức năng tìm đường A*.
-- ============================================================


-- ============================================================
-- BƯỚC 0: XÓA CẤU TRÚC CŨ (nếu chạy lại)
-- ============================================================
DROP VIEW     IF EXISTS v_roads_astar CASCADE;
DROP TABLE    IF EXISTS news         CASCADE;
DROP TABLE    IF EXISTS landmarks    CASCADE;
DROP TABLE    IF EXISTS roads        CASCADE;
DROP TABLE    IF EXISTS road_nodes   CASCADE;
DROP TABLE    IF EXISTS admin_config CASCADE;

DROP TABLE    IF EXISTS rooms        CASCADE;

DROP FUNCTION IF EXISTS find_path_astar(INT, INT);
DROP FUNCTION IF EXISTS fn_calc_road_cost();


-- ============================================================
-- BƯỚC 1: KÍCH HOẠT TIỆN ÍCH MỞ RỘNG
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;


-- ============================================================
-- BƯỚC 2: TẠO BẢNG (TABLES)
-- LƯU Ý: Dùng GENERATED ALWAYS AS IDENTITY thay cho SERIAL (Chuẩn SQL mới)
-- ============================================================

-- -------------------------------------------------------
-- Bảng: road_nodes
-- -------------------------------------------------------
CREATE TABLE road_nodes (
    id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  TEXT,
    geom  GEOMETRY(Point, 4326) NOT NULL,
    -- Tính năng Generated Columns (Yêu cầu PostgreSQL 12+) tự động lấy X, Y từ geom
    x     FLOAT GENERATED ALWAYS AS (ST_X(geom)) STORED,
    y     FLOAT GENERATED ALWAYS AS (ST_Y(geom)) STORED
);

-- -------------------------------------------------------
-- Bảng: roads
-- -------------------------------------------------------
CREATE TABLE roads (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         TEXT,
    source       INT REFERENCES road_nodes(id) ON DELETE CASCADE,
    target       INT REFERENCES road_nodes(id) ON DELETE CASCADE,
    cost         FLOAT CHECK (cost >= 0),
    reverse_cost FLOAT DEFAULT -1,
    geom         GEOMETRY(LineString, 4326) NOT NULL
);


-- -------------------------------------------------------
-- Bảng: landmarks
-- -------------------------------------------------------
CREATE TABLE landmarks (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              TEXT NOT NULL,
    category          TEXT,
    description       TEXT,
    image_url         TEXT,
    metadata          JSONB DEFAULT '{}',
    connected_node_id INT REFERENCES road_nodes(id) ON DELETE SET NULL,
    geom              GEOMETRY(Point, 4326) NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------
-- Bảng: news
-- -------------------------------------------------------
CREATE TABLE news (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'tin-tuc',
    summary      TEXT,                                  -- Thêm: Tóm tắt ngắn hiển thị ở danh sách
    content      TEXT,                                  -- Nội dung chi tiết (hỗ trợ HTML/Markdown)
    image_url    TEXT,
    is_published BOOLEAN DEFAULT TRUE,                  -- Thêm: Quản lý bản nháp / xuất bản
    published_at TIMESTAMPTZ DEFAULT NOW(),
    landmark_id  INT REFERENCES landmarks(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------
-- Bảng: admin_config
-- Lưu cấu hình hệ thống, bao gồm mật khẩu xác thực
-- quản trị viên sử dụng bởi Validate.vue (route /admin/validate).
-- -------------------------------------------------------
CREATE TABLE admin_config (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    config_key   TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description  TEXT,
    is_secret    BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: mật khẩu mặc định cho màn hình xác thực (Validate.vue)
-- ⚠ Đổi giá trị này trước khi deploy lên production.
INSERT INTO admin_config (config_key, config_value, description, is_secret)
VALUES ('admin_password', 'admin@tvu2025', 'Mật khẩu xác thực trang quản trị (/admin/validate)', TRUE)
ON CONFLICT (config_key) DO NOTHING;


-- -------------------------------------------------------
-- Bảng: rooms (Quản lý các phòng thuộc Landmark/Tòa nhà)
-- -------------------------------------------------------
CREATE TABLE rooms (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    landmark_id  INT NOT NULL REFERENCES landmarks(id) ON DELETE CASCADE,
    room_name    TEXT NOT NULL,
    description  TEXT
);

-- ============================================================
-- BƯỚC 3: CHỈ MỤC (INDEX)
-- ============================================================
-- Không gian & Cột tra cứu nhanh
CREATE INDEX idx_road_nodes_geom ON road_nodes USING GIST (geom);
CREATE INDEX idx_roads_geom      ON roads      USING GIST (geom);
CREATE INDEX idx_roads_source    ON roads (source);
CREATE INDEX idx_roads_target    ON roads (target);
CREATE INDEX idx_landmarks_geom  ON landmarks  USING GIST (geom);
CREATE INDEX idx_landmarks_cat   ON landmarks  (category);
CREATE INDEX idx_news_published  ON news       (published_at DESC);

-- Khóa ngoại (Tối ưu hóa tốc độ khi JOIN hoặc XÓA)
CREATE INDEX idx_landmarks_connected_node ON landmarks (connected_node_id);
CREATE INDEX idx_news_landmark_id         ON news (landmark_id);

-- Chỉ mục cho bảng rooms
CREATE INDEX idx_rooms_landmark_id ON rooms (landmark_id);
CREATE INDEX idx_rooms_name        ON rooms (room_name);

-- ============================================================
-- BƯỚC 4: HÀM VÀ TRIGGER TỰ ĐỘNG
-- ============================================================

-- Tự động tính cost cho roads từ geom bằng METRE
CREATE OR REPLACE FUNCTION fn_calc_road_cost()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cost := ST_Length(NEW.geom::geography);

    -- BUG FIX: DEFAULT là -1 (không phải NULL), nên điều kiện IS NULL không bao giờ đúng.
    -- Giải pháp: Nếu reverse_cost <= 0 (tức là chưa được set thủ công thành giá trị dương),
    -- tự động gán bằng cost → đường 2 chiều (đây là hành vi mong muốn cho campus).
    -- Muốn đường 1 chiều thực sự: truyền reverse_cost = -1 TƯỜNG MINH sau khi INSERT.
    IF NEW.reverse_cost IS NULL OR NEW.reverse_cost < 0 THEN
        NEW.reverse_cost := NEW.cost;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calc_road_cost
BEFORE INSERT OR UPDATE ON roads
FOR EACH ROW EXECUTE FUNCTION fn_calc_road_cost();


-- ============================================================
-- BƯỚC 5: VIEW – Hỗ trợ thuật toán A* của pgRouting
-- ============================================================
CREATE OR REPLACE VIEW v_roads_astar AS
SELECT
    r.id,
    r.source,
    r.target,
    r.cost,
    r.reverse_cost,
    n1.x  AS x1,  n1.y  AS y1,
    n2.x  AS x2,  n2.y  AS y2,
    r.name,
    r.geom
FROM roads r
JOIN road_nodes n1 ON r.source = n1.id
JOIN road_nodes n2 ON r.target = n2.id;


-- ============================================================
-- BƯỚC 6: HÀM TÌM ĐƯỜNG A* (STORED FUNCTION)
-- ============================================================
CREATE OR REPLACE FUNCTION find_path_astar(
    start_node INT,
    end_node   INT
)
RETURNS TABLE(
    seq   INT,
    node  BIGINT,
    edge  BIGINT,
    name  TEXT,
    cost  FLOAT,
    geom  GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        path.seq,
        path.node,
        path.edge,
        r.name,
        path.cost,
        r.geom
    FROM pgr_astar(
        'SELECT id, source, target, cost, reverse_cost, x1, y1, x2, y2 FROM v_roads_astar',
        start_node,
        end_node,
        directed  => false,
        heuristic => 2
    ) AS path
    LEFT JOIN roads r ON path.edge = r.id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- PHẦN 2: SEED DATA – Dữ liệu từ landmark.sql
-- ============================================================

-- ============================================================
-- DỮ LIỆU CHÈN VÀO BẢNG: landmarks
-- ============================================================

INSERT INTO landmarks (name, category, description, geom) VALUES
('Tòa nhà B1', 'Khoa Kinh tế - Luật và Ngoại ngữ', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34593300613994, 9.922996662018221), 4326)),
('Tòa nhà B2', 'Phòng lý thuyết', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34612516528688, 9.92272713746351), 4326)),
('Tòa nhà B3', 'Phòng lý thuyết', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34614187477723, 9.922500818784172), 4326)),
('Tòa nhà A1', 'Khu hiệu bộ', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.3469362024444, 9.923229497144021), 4326)),
('Phòng Công tác Sinh viên', 'Văn phòng', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.3467503094339, 9.922986719300553), 4326)),
('Tòa nhà C1', 'Khoa Y Dược', 'Điểm mốc C1', ST_SetSRID(ST_MakePoint(106.34783224742603, 9.923328253636143), 4326)),
('Tòa nhà C2', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34765888640061, 9.92283858303604), 4326)),
('Tòa nhà C3', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34800769702701, 9.922869444651269), 4326)),
('Tòa nhà C4', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34830057818306, 9.922753222122253), 4326)),
('Tòa nhà C5', 'Khoa Kỹ thuật và Công nghệ', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.3483632387755, 9.922430203622184), 4326)),
('Tòa nhà C6', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.3483632387755, 9.922181252840659), 4326)),
('Tòa nhà C7', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34807082208744, 9.922063978765678), 4326)),
('Tòa nhà C8', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34772618883324, 9.922041346858919), 4326)),
('Tòa nhà C9', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34837343289212, 9.921826213527524), 4326)),
('Tòa nhà D3', 'Phòng lý thuyết', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34796466398785, 9.92142777449368), 4326)),
('Tòa nhà D4', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34841837587231, 9.921225392998636), 4326)),
('Tòa nhà D5', 'Uncategorized', 'Điểm tọa độ số 16', ST_SetSRID(ST_MakePoint(106.3482043605132, 9.920985064283698), 4326)),
('Tòa nhà A2', 'Phòng lý thuyết', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34725390787702, 9.922394842163328), 4326)),
('Tòa nhà B5', 'Khoa Nông nghiệp Thủy sản', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34627800205635, 9.921621156236938), 4326)),
('Tòa nhà B6', 'Nhà nghỉ chuyên gia', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34625874060953, 9.921186878527777), 4326)),
('Sân cỏ nhân tạo', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34721966821894, 9.920792654836589), 4326)),
('Tòa nhà D6', 'Khoa Sư phạm', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34797086043449, 9.920069559393042), 4326)),
('Tòa nhà D7', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34800297381156, 9.919954390188778), 4326)),
('Tòa nhà B8', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34746193260332, 9.919832738205528), 4326)),
('Tòa nhà B7', 'Thư viện', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34683855955439, 9.920016181800463), 4326)),
('Tòa nhà D8', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34845123375567, 9.919812835002489), 4326)),
('Tòa nhà B9', 'Viện Công nghệ Sinh học', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34641635317041, 9.919056894741288), 4326)),
('Chăn nuôi-trồng trọt', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34883910605839, 9.919248580451807), 4326)),
('Tòa nhà G1', 'Ký túc xá', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34915741307742, 9.921990764438164), 4326)),
('Tòa nhà G5', 'Ký túc xá', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34924446585234, 9.921202332978737), 4326)),
('Tòa nhà G3', 'Ký túc xá', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.35005212216072, 9.921621559610571), 4326)),
('Tòa nhà G4', 'Ký túc xá', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.35009806668052, 9.921285701954346), 4326)),
('Tòa nhà G2', 'Ký túc xá', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.35001826760481, 9.922086044106194), 4326)),
('Tòa nhà E4', 'Bệnh viện', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34690113319476, 9.924312649657367), 4326)),
('Tòa nhà E3', 'Khoa Ngôn ngữ -Văn hóa-Nghệ thuật Khmer Nam Bộ', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34631111103704, 9.924779511575807), 4326)),
('Tòa nhà E1', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.3459193735481, 9.924045871692016), 4326)),
('Tòa nhà E2', 'Phòng lý thuyết', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34576461305699, 9.924536553094526), 4326)),
('Sân bóng chuyền', 'Uncategorized', 'Điểm tọa độ từ GeoJSON', ST_SetSRID(ST_MakePoint(106.34899227694387, 9.920584312211332), 4326));


-- ============================================================
-- PHẦN 3: SEED DATA – Dữ liệu tin tức từ news.sql
-- ============================================================

INSERT INTO news (title, content, image_url, type, published_at, landmark_id) VALUES

-- ── THÔNG BÁO ─────────────────────────────────────────────────────────────────
(
    'Cập nhật dữ liệu bản đồ số – Khoa Y Dược',
    E'Hệ thống Bản đồ số Đại học Trà Vinh vừa hoàn thiện việc số hóa toàn bộ sơ đồ phòng học, phòng thực hành và các phòng chức năng thuộc Khoa Y Dược. Sinh viên và giảng viên có thể tra cứu phòng cụ thể trực tiếp trên ứng dụng.\n\nMọi thắc mắc vui lòng liên hệ Phòng Công nghệ Thông tin – Tòa A, tầng 3.',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    'thong-bao', '2026-05-30 08:00:00+07', 6
),
(
    'Bảo trì hệ thống tìm đường 22h–24h ngày 05/06',
    E'Phòng CNTT thông báo: Hệ thống tìm đường thông minh trên Bản đồ số TVU sẽ tạm gián đoạn từ 22:00 đến 24:00 ngày 05/06/2026 để nâng cấp cơ sở hạ tầng máy chủ và cập nhật dữ liệu đường đi mới nhất.\n\nTrong thời gian bảo trì, tính năng xem bản đồ vẫn hoạt động bình thường. Xin lỗi vì sự bất tiện này.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
    'thong-bao', '2026-05-25 14:00:00+07', 4
),
(
    'Thông báo lịch thi học kỳ 2 năm học 2025–2026',
    E'Phòng Đào tạo thông báo lịch thi kết thúc học kỳ 2 năm học 2025–2026 cho tất cả hệ đào tạo chính quy. Sinh viên vui lòng kiểm tra lịch thi và phòng thi trên Cổng thông tin sinh viên trước ngày 01/06/2026.\n\nLưu ý: Sinh viên cần mang theo thẻ sinh viên hoặc CCCD khi dự thi. Không chấp nhận giấy tờ hết hạn.',
    'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&q=80',
    'thong-bao', '2026-05-22 09:00:00+07', 5
),

-- ── TIN TỨC ───────────────────────────────────────────────────────────────────
(
    'TVU lọt Top 10 Đại học xanh Việt Nam 2026',
    E'Đại học Trà Vinh chính thức được xếp hạng trong Top 10 Đại học Xanh tại Việt Nam năm 2026 theo bảng xếp hạng GreenMetric.\n\nThành tích này ghi nhận nỗ lực phát triển không gian xanh, tiết kiệm năng lượng và quản lý chất thải bền vững của nhà trường trong nhiều năm qua.',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80',
    'tin-tuc', '2026-05-28 10:00:00+07', 21
),
(
    'Sinh viên TVU đạt giải Nhất cuộc thi Lập trình AI Quốc gia 2026',
    E'Đội tuyển sinh viên Khoa Công nghệ Thông tin Đại học Trà Vinh xuất sắc giành giải Nhất tại cuộc thi Lập trình Trí tuệ Nhân tạo Quốc gia 2026 tổ chức tại Hà Nội.\n\nDự án của đội tập trung vào ứng dụng mô hình học sâu để dự báo tình trạng giao thông đô thị, được hội đồng đánh giá cao về tính ứng dụng thực tiễn.',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
    'tin-tuc', '2026-05-20 14:30:00+07', 10
),
(
    'Hợp tác quốc tế: TVU ký kết MOU với Đại học Khon Kaen, Thái Lan',
    E'Đại học Trà Vinh vừa ký kết Biên bản ghi nhớ hợp tác (MOU) với Đại học Khon Kaen (Thái Lan) trong các lĩnh vực trao đổi sinh viên, nghiên cứu khoa học chung và phát triển chương trình đào tạo song ngữ.\n\nThỏa thuận có hiệu lực từ tháng 6/2026, mở ra cơ hội cho sinh viên hai trường tham gia các chương trình trao đổi ngắn hạn và dài hạn.',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
    'tin-tuc', '2026-05-15 08:00:00+07', 4
),

-- ── SỰ KIỆN ───────────────────────────────────────────────────────────────────
(
    'Ngày hội việc làm – Job Fair TVU 2026',
    E'Ngày hội việc làm TVU 2026 quy tụ hơn 50 doanh nghiệp uy tín trong và ngoài tỉnh, với hàng ngàn vị trí tuyển dụng cho sinh viên năm cuối và cựu sinh viên.\n\nCác hoạt động bao gồm: phỏng vấn trực tiếp, hội thảo kỹ năng mềm, và triển lãm ngành nghề.\n\nThời gian: 8:00 – 17:00 ngày 15/06/2026\nĐịa điểm: Hội trường Lớn – Tòa B, Đại học Trà Vinh',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
    'su-kien', '2026-06-15 07:30:00+07', 1
),
(
    'Hội thảo Ứng dụng GIS trong Quản lý Đô thị',
    E'Hội thảo khoa học quốc gia với chủ đề "Ứng dụng Hệ thống Thông tin Địa lý (GIS) trong quy hoạch và quản lý đô thị thông minh" sẽ diễn ra tại Trường ĐH Trà Vinh.\n\nĐây là cơ hội để sinh viên ngành CNTT, Địa lý và Quy hoạch giao lưu với các chuyên gia hàng đầu.\n\nThời gian: 8:00 – 12:00 ngày 20/05/2026\nĐịa điểm: Phòng hội thảo – Tòa C',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'su-kien', '2026-05-20 08:00:00+07', 10
),
(
    'Lễ trao bằng tốt nghiệp đợt 1 năm 2026',
    E'Lễ trao bằng tốt nghiệp đợt 1 năm học 2025–2026 sẽ được tổ chức trọng thể tại Nhà thi đấu đa năng Đại học Trà Vinh.\n\nSinh viên tốt nghiệp vui lòng đăng ký tham dự trước ngày 25/05/2026 qua Cổng thông tin sinh viên.\n\nThời gian: 7:30 – 11:30 ngày 01/06/2026\nĐịa điểm: Nhà thi đấu đa năng, Đại học Trà Vinh',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
    'su-kien', '2026-06-01 07:00:00+07', 4
),
(
    'Cuộc thi Hackathon TVU 2026 – Chủ đề Smart Campus',
    E'Phòng CNTT phối hợp Khoa CNTT tổ chức cuộc thi lập trình 24 giờ Hackathon TVU 2026 với chủ đề "Giải pháp công nghệ cho Khuôn viên thông minh".\n\nĐối tượng tham gia: Sinh viên tất cả các ngành, tối đa 4 thành viên/đội.\nGiải thưởng: Giải Nhất 10.000.000đ | Nhì 5.000.000đ | Ba 2.000.000đ.\n\nThời gian: 7:00 ngày 10/06 – 7:00 ngày 11/06/2026\nĐịa điểm: Phòng máy tính – Tòa A, tầng 2',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
    'su-kien', '2026-06-10 07:00:00+07', 10
),
(
    'Tuần lễ Văn hóa các dân tộc Đồng bằng Sông Cửu Long 2026',
    E'Đại học Trà Vinh tổ chức Tuần lễ Văn hóa các dân tộc Đồng bằng Sông Cửu Long lần thứ 5 nhân kỷ niệm ngày thành lập trường.\n\nCác hoạt động: triển lãm văn hóa Khmer – Kinh – Hoa, biểu diễn nghệ thuật dân gian, hội chợ ẩm thực vùng miền và giao lưu thể thao.\n\nThời gian: 25/05 – 30/05/2026\nĐịa điểm: Sân vận động và khu vực trung tâm khuôn viên TVU',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    'su-kien', '2026-05-25 07:00:00+07', 35
);


-- ============================================================
-- PHẦN 4: SEED DATA – Dữ liệu phòng từ rooms.sql
-- ============================================================
DO $$
DECLARE
    r RECORD;
    floor INT;
    room_num INT;
    room_name_str TEXT;
    side TEXT;
    descr TEXT;
    -- Biến lưu tên rút gọn của tòa nhà (ví dụ: 'C7', 'B1')
    short_name TEXT;
BEGIN
    -- Duyệt qua tất cả các landmark là tòa nhà
    FOR r IN SELECT id, name FROM landmarks WHERE name LIKE 'Tòa nhà %' LOOP

        -- Trích xuất ký tự viết tắt (ví dụ: 'Tòa nhà C7' -> 'C7')
        short_name := SUBSTRING(r.name FROM 'Tòa nhà (.+)');

        -- Sinh phòng cho tầng 1, 2 và 3
        FOR floor IN 1..3 LOOP
            -- Mỗi tầng sinh ngẫu nhiên 2 phòng (phòng 01 và phòng 02)
            FOR room_num IN 1..2 LOOP

                -- Định dạng tên phòng: [Tên viết tắt] + [Tầng] + . + [Mã phòng]
                -- Ví dụ: C71.101, C71.102, C71.201...
                room_name_str := short_name || '1.' || floor || '0' || room_num;

                -- Chọn ngẫu nhiên hướng bên trái hoặc bên phải
                IF room_num % 2 = 1 THEN
                    side := 'phía bên phải';
                ELSE
                    side := 'phía bên trái';
                END IF;

                -- Tạo chuỗi mô tả
                descr := 'Phòng nằm tại tầng ' || floor || ' phòng ' || room_num || ' nằm ' || side;

                -- Chèn dữ liệu vào bảng rooms
                INSERT INTO rooms (landmark_id, room_name, description)
                VALUES (r.id, room_name_str, descr);

            END LOOP;
        END LOOP;

    END LOOP;
END $$;



-- ============================================================
-- PHẦN 4: SEED DATA – Dữ liệu đường từ road.sql
-- (Mạng lưới giao thông nội bộ khuôn viên TVU)
-- ============================================================

-- BƯỚC 1: Nạp thông tin hình học của các con đường từ file GeoJSON (Đã dọn dẹp và sửa lỗi topology)
INSERT INTO roads (name, geom) VALUES
('Cổng trường', ST_GeomFromText('LINESTRING(106.346493 9.923712, 106.346504 9.923522)', 4326)),
('Đoạn B1', ST_GeomFromText('LINESTRING(106.346504 9.923522, 106.34634 9.92352, 106.346125 9.923193)', 4326)),
('Đoạn A1', ST_GeomFromText('LINESTRING(106.346504 9.923522, 106.346663 9.923534, 106.346831 9.923374)', 4326)),
('Đường Nguyễn Thiện Thành', ST_GeomFromText('LINESTRING(106.346493 9.923712, 106.347403 9.923771)', 4326)),
('Cổng trường 2', ST_GeomFromText('LINESTRING(106.347403 9.923771, 106.347432 9.923535)', 4326)),
('Đoạn A1 2', ST_GeomFromText('LINESTRING(106.347432 9.923535, 106.347089 9.923384, 106.346831 9.923374)', 4326)),
('Đoạn C1', ST_GeomFromText('LINESTRING(106.347432 9.923535, 106.347654 9.923407, 106.347838 9.923425)', 4326)),
('Đường Nội Bộ Chính', ST_GeomFromText('LINESTRING(106.346504 9.923522, 106.346642 9.922029)', 4326)),
('Ngã 3 đường số 1', ST_GeomFromText('LINESTRING(106.34657 9.922763, 106.346583 9.922618)', 4326)),
('Đường Nội Bộ 2', ST_GeomFromText('LINESTRING(106.346594 9.922519, 106.346583 9.922618)', 4326)),
('Đường Nội Bộ 3', ST_GeomFromText('LINESTRING(106.346583 9.922618, 106.347229 9.922685)', 4326)),
('Đường Nội Bộ 4', ST_GeomFromText('LINESTRING(106.346594 9.922519, 106.346642 9.922029)', 4326)),
('Đường Nội Bộ 5', ST_GeomFromText('LINESTRING(106.346642 9.922029, 106.346691 9.921669)', 4326)),
('Đường Nội Bộ 6', ST_GeomFromText('LINESTRING(106.346752 9.921236, 106.346691 9.921669)', 4326)),
('Đường Nội Bộ 7', ST_GeomFromText('LINESTRING(106.346446 9.92121, 106.346752 9.921236)', 4326)),
('Đường Nội Bộ 8', ST_GeomFromText('LINESTRING(106.346752 9.921236, 106.346873 9.920287)', 4326)),
('Đường Nội Bộ 9', ST_GeomFromText('LINESTRING(106.346873 9.920287, 106.347698 9.920371)', 4326)),
('Đường Nội Bộ 10', ST_GeomFromText('LINESTRING(106.346752 9.921236, 106.347622 9.921295)', 4326)),
('Đường Nội Bộ 11', ST_GeomFromText('LINESTRING(106.347622 9.921295, 106.347656 9.920938)', 4326)),
('Đường Nội Bộ 12', ST_GeomFromText('LINESTRING(106.347622 9.921295, 106.348044 9.921104)', 4326)),
('Đường Nội Bộ 13', ST_GeomFromText('LINESTRING(106.347656 9.920938, 106.348022 9.920972)', 4326)),
('Đường Nội Bộ 14', ST_GeomFromText('LINESTRING(106.348022 9.920972, 106.348044 9.921104)', 4326)),
('Đường Nội Bộ 15', ST_GeomFromText('LINESTRING(106.347656 9.920938, 106.347698 9.920371)', 4326)),
('Đường Nội Bộ 16', ST_GeomFromText('LINESTRING(106.347698 9.920371, 106.347601 9.920149)', 4326)),
('Đường Khu Trung Tâm', ST_GeomFromText('LINESTRING(106.347698 9.920371, 106.348208 9.920451, 106.348326 9.920173, 106.348333 9.919941)', 4326)),
('Đường Nội Bộ 17', ST_GeomFromText('LINESTRING(106.347601 9.920149, 106.347637 9.919835)', 4326)),
('Đường Vành Đai Phía Nam', ST_GeomFromText('LINESTRING(106.347637 9.919835, 106.347661 9.919645, 106.346596 9.919502, 106.346617 9.918951)', 4326)),
('Đường Nội Bộ 18', ST_GeomFromText('LINESTRING(106.348208 9.920451, 106.348806 9.920555)', 4326)),
('Đường Nội Bộ 19', ST_GeomFromText('LINESTRING(106.347622 9.921295, 106.347981 9.92132)', 4326)),
('Đường Kết Nối Dọc', ST_GeomFromText('LINESTRING(106.346642 9.922029, 106.347204 9.922085)', 4326)),
('Đường Nội Bộ 20', ST_GeomFromText('LINESTRING(106.347229 9.922685, 106.347498 9.922715)', 4326)),
('Đường Trục Dọc Phía Đông', ST_GeomFromText('LINESTRING(106.347432 9.923535, 106.347498 9.922715)', 4326)),
('Đường Nội Bộ 21', ST_GeomFromText('LINESTRING(106.347498 9.922715, 106.347677 9.92273)', 4326)),
('Đường Nội Bộ 22', ST_GeomFromText('LINESTRING(106.347677 9.92273, 106.348017 9.922758)', 4326)),
('Đường Nội Bộ 23', ST_GeomFromText('LINESTRING(106.348017 9.922758, 106.348195 9.922777, 106.348205 9.922667)', 4326)),
('Đường Nội Bộ 24', ST_GeomFromText('LINESTRING(106.348205 9.922667, 106.348232 9.922423)', 4326)),
('Đường Nội Bộ 25', ST_GeomFromText('LINESTRING(106.348232 9.922423, 106.348244 9.922168)', 4326)),
('Đường Nội Bộ 26', ST_GeomFromText('LINESTRING(106.348071 9.922157, 106.348244 9.922168)', 4326)),
('Đường Nội Bộ 27', ST_GeomFromText('LINESTRING(106.347724 9.922131, 106.348071 9.922157)', 4326)),
('Đường Nội Bộ 28', ST_GeomFromText('LINESTRING(106.347498 9.922715, 106.347521 9.922411)', 4326)),
('Đường Nội Bộ 29', ST_GeomFromText('LINESTRING(106.347521 9.922411, 106.34753 9.922127)', 4326)),
('Đường Nội Bộ 30', ST_GeomFromText('LINESTRING(106.34753 9.922127, 106.347724 9.922131)', 4326)),
('Đường Nội Bộ 31', ST_GeomFromText('LINESTRING(106.34753 9.922127, 106.347622 9.921295)', 4326)),
('Đường Nội Bộ 32', ST_GeomFromText('LINESTRING(106.34838 9.921357, 106.347981 9.92132)', 4326)),
('Đường Nội Bộ 33', ST_GeomFromText('LINESTRING(106.348244 9.922168, 106.34828 9.921771)', 4326)),
('Đường Nội Bộ 34', ST_GeomFromText('LINESTRING(106.34828 9.921771, 106.348293 9.921672, 106.34838 9.921357)', 4326)),
('Đường Nội Bộ 35', ST_GeomFromText('LINESTRING(106.34838 9.921357, 106.348689 9.921379)', 4326)),
('Đường Trục Đông Ngoài', ST_GeomFromText('LINESTRING(106.348348 9.923844, 106.348689 9.921379)', 4326)),
('Đường Nội Bộ 36', ST_GeomFromText('LINESTRING(106.348689 9.921379, 106.348806 9.920555)', 4326)),
('Đường Nội Bộ 37', ST_GeomFromText('LINESTRING(106.348806 9.920555, 106.34892 9.91981)', 4326)),
('Đường Nội Bộ 38', ST_GeomFromText('LINESTRING(106.34892 9.91981, 106.348994 9.919261)', 4326)),
('Đường Nội Bộ 39', ST_GeomFromText('LINESTRING(106.348689 9.921379, 106.348908 9.921402)', 4326)),
('Đường Nội Bộ 40', ST_GeomFromText('LINESTRING(106.348908 9.921402, 106.34926 9.921439)', 4326)),
('Đường Nội Bộ 41', ST_GeomFromText('LINESTRING(106.348908 9.921402, 106.348877 9.921788, 106.34922 9.921819)', 4326)),
('Đường Nội Bộ 42', ST_GeomFromText('LINESTRING(106.34926 9.921439, 106.349697 9.921485)', 4326)),
('Đường Nội Bộ 43', ST_GeomFromText('LINESTRING(106.34922 9.921819, 106.349664 9.921856)', 4326)),
('Đường Nội Bộ 44', ST_GeomFromText('LINESTRING(106.349664 9.921856, 106.349697 9.921485)', 4326)),
('Đường Nội Bộ 45', ST_GeomFromText('LINESTRING(106.349664 9.921856, 106.350089 9.921889)', 4326)),
('Đường Nội Bộ 46', ST_GeomFromText('LINESTRING(106.349697 9.921486, 106.350133 9.921524)', 4326)),
('Vòng Xoay / Nhánh Đông', ST_GeomFromText('LINESTRING(106.350089 9.921889, 106.350535 9.921924, 106.35057 9.921575, 106.350133 9.921524)', 4326)),
('Đường Nội Bộ 47', ST_GeomFromText('LINESTRING(106.348806 9.920555, 106.348962 9.920572)', 4326)),
('Đường Vành Đai Bắc', ST_GeomFromText('LINESTRING(106.347403 9.923771, 106.348348 9.923844)', 4326)),
('Đường Khu Tây Bắc 1', ST_GeomFromText('LINESTRING(106.346196 9.92402, 106.346347 9.924034)', 4326)),
('Đường Khu Tây Bắc 2', ST_GeomFromText('LINESTRING(106.346347 9.924034, 106.346304 9.924573)', 4326)),
('Đường Khu Tây Bắc 3', ST_GeomFromText('LINESTRING(106.34604 9.924564, 106.346304 9.924573)', 4326)),
('Đường Khu Tây Bắc 4', ST_GeomFromText('LINESTRING(106.346292 9.924692, 106.346304 9.924573)', 4326)),
('Đường Kết Nối Tây Bắc 1', ST_GeomFromText('LINESTRING(106.346762 9.923867, 106.347388 9.923922)', 4326)),
('Đường Kết Nối Tây Bắc 2', ST_GeomFromText('LINESTRING(106.346355 9.923829, 106.346762 9.923867)', 4326)),
('Đường Kết Nối Tây Bắc 3', ST_GeomFromText('LINESTRING(106.346355 9.923829, 106.346369 9.9237, 106.346493 9.923712)', 4326)),
('Đường Kết Nối Tây Bắc 4', ST_GeomFromText('LINESTRING(106.346347 9.924034, 106.346355 9.923829)', 4326)),
('Đường Kết Nối Tây Bắc 5', ST_GeomFromText('LINESTRING(106.347403 9.923771, 106.347388 9.923922)', 4326)),
('Đường Phụ 1', ST_GeomFromText('LINESTRING(106.346756 9.923956, 106.346762 9.923867)', 4326)),
('Đường Phụ 2', ST_GeomFromText('LINESTRING(106.346467 9.922754, 106.34657 9.922763)', 4326)),
('Đường Phụ 3', ST_GeomFromText('LINESTRING(106.346479 9.922511, 106.346594 9.922519)', 4326)),
('Đường Phụ 4', ST_GeomFromText('LINESTRING(106.346548 9.921651, 106.346691 9.921669)', 4326)),
('Đường Phụ 5', ST_GeomFromText('LINESTRING(106.347204 9.922085, 106.347196 9.922185)', 4326)),
('Đường Kỹ Thuật 1', ST_GeomFromText('LINESTRING(106.34926 9.921439, 106.349272 9.921325)', 4326)),
('Đường Kỹ Thuật 2', ST_GeomFromText('LINESTRING(106.349214 9.92194, 106.34922 9.921819)', 4326)),
('Đường Kỹ Thuật 3', ST_GeomFromText('LINESTRING(106.350086 9.922004, 106.350089 9.921889)', 4326)),
('Đường Kỹ Thuật 4', ST_GeomFromText('LINESTRING(106.350133 9.921524, 106.350137 9.921387)', 4326)),
('Đường Phụ Cận Nam 1', ST_GeomFromText('LINESTRING(106.348745 9.919773, 106.34892 9.91981)', 4326)),
('Đường Phụ Cận Nam 2', ST_GeomFromText('LINESTRING(106.348848 9.919232, 106.348994 9.919261)', 4326)),
('Đường Nội Bộ Nhỏ 1', ST_GeomFromText('LINESTRING(106.346873 9.920287, 106.346871 9.920145)', 4326)),
('Đường Nội Bộ Nhỏ 2', ST_GeomFromText('LINESTRING(106.347698 9.920371, 106.347885 9.920201)', 4326)),
('Đường Nội Bộ Nhỏ 3', ST_GeomFromText('LINESTRING(106.347637 9.919835, 106.3478744 9.9198616)', 4326)),
('Đường Nội Bộ Nhỏ 4', ST_GeomFromText('LINESTRING(106.347556 9.919829, 106.347637 9.919835)', 4326)),
('Đường Liên Kết Góc 1', ST_GeomFromText('LINESTRING(106.348044 9.921104, 106.348097 9.921074)', 4326)),
('Đường Liên Kết Góc 2', ST_GeomFromText('LINESTRING(106.348022 9.920972, 106.348095 9.920975)', 4326)),
('Đường Nhánh Sân 1', ST_GeomFromText('LINESTRING(106.348333 9.919941, 106.348243 9.919931)', 4326)),
('Đường Nhánh Sân 2', ST_GeomFromText('LINESTRING(106.348333 9.919941, 106.348428 9.919956)', 4326)),
('Đường Kết Nối Nhỏ', ST_GeomFromText('LINESTRING(106.34838 9.921357, 106.348389 9.921309)', 4326)),
('Đường Nối Chéo', ST_GeomFromText('LINESTRING(106.346677 9.922879, 106.34657 9.922763)', 4326)),
('Đường Nhánh Nối Cuối', ST_GeomFromText('LINESTRING(106.347622 9.921295, 106.347448 9.921157)', 4326));


-- BƯỚC 2: Tự động trích xuất các điểm đầu và cuối từ bảng roads để đẩy vào bảng road_nodes
INSERT INTO road_nodes (geom)
SELECT DISTINCT geom FROM (
    SELECT ST_StartPoint(geom) AS geom FROM roads
    UNION
    SELECT ST_EndPoint(geom) AS geom FROM roads
) AS unique_nodes
ON CONFLICT DO NOTHING;


-- BƯỚC 3: Xây dựng mối liên kết đồ thị hoàn chỉnh (Cập nhật trường source và target)
UPDATE roads r
SET
    source = (SELECT id FROM road_nodes n WHERE ST_DWithin(ST_StartPoint(r.geom), n.geom, 0.00001) LIMIT 1),
    target = (SELECT id FROM road_nodes n WHERE ST_DWithin(ST_EndPoint(r.geom), n.geom, 0.00001) LIMIT 1)
WHERE source IS NULL OR target IS NULL;
