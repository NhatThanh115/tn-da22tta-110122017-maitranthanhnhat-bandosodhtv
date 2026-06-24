-- Active: 1779293081967@@127.0.0.1@5432@postgres@public
-- ============================================================
-- DỮ LIỆU CHÈN VÀO BẢNG: news (Tin tức / Thông báo / Sự kiện)
-- Database: PostgreSQL
-- Mô tả: Dữ liệu mẫu cho hệ thống tin tức bản đồ số TVU.
--        Mỗi bản ghi có thể liên kết với một landmark (địa điểm)
--        qua khóa ngoại landmark_id.
-- Mapping landmark_id:
--   1  = Tòa nhà B1 (Khoa Kinh tế - Luật và Ngoại ngữ)
--   4  = Tòa nhà A1 (Khu hiệu bộ)
--   5  = Phòng Công tác Sinh viên
--   6  = Tòa nhà C1 (Khoa Y Dược)
--   10 = Tòa nhà C5 (Khoa Kỹ thuật và Công nghệ)
--   21 = Sân cỏ nhân tạo
--   35 = Tòa nhà E3 (Khoa Ngôn ngữ - Văn hóa - Nghệ thuật Khmer)
-- ============================================================


-- ============================================================
-- CHÈN DỮ LIỆU MẪU
-- ============================================================

INSERT INTO news (title, content, image_url, type, published_at, landmark_id) VALUES

-- ── THÔNG BÁO ─────────────────────────────────────────────────────────────────
(
    'Cập nhật dữ liệu bản đồ số – Khoa Y Dược',
    E'Hệ thống Bản đồ số Đại học Trà Vinh vừa hoàn thiện việc số hóa toàn bộ sơ đồ phòng học, phòng thực hành và các phòng chức năng thuộc Khoa Y Dược. Sinh viên và giảng viên có thể tra cứu phòng cụ thể trực tiếp trên ứng dụng.\n\nMọi thắc mắc vui lòng liên hệ Phòng Công nghệ Thông tin – Tòa A, tầng 3.',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    'thong-bao',
    '2026-05-30 08:00:00+07',
    6   -- Tòa nhà C1 (Khoa Y Dược)
),
(
    'Bảo trì hệ thống tìm đường 22h–24h ngày 05/06',
    E'Phòng CNTT thông báo: Hệ thống tìm đường thông minh trên Bản đồ số TVU sẽ tạm gián đoạn từ 22:00 đến 24:00 ngày 05/06/2026 để nâng cấp cơ sở hạ tầng máy chủ và cập nhật dữ liệu đường đi mới nhất.\n\nTrong thời gian bảo trì, tính năng xem bản đồ vẫn hoạt động bình thường. Xin lỗi vì sự bất tiện này.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
    'thong-bao',
    '2026-05-25 14:00:00+07',
    4   -- Tòa nhà A1 (Khu hiệu bộ – nơi đặt Phòng CNTT)
),
(
    'Thông báo lịch thi học kỳ 2 năm học 2025–2026',
    E'Phòng Đào tạo thông báo lịch thi kết thúc học kỳ 2 năm học 2025–2026 cho tất cả hệ đào tạo chính quy. Sinh viên vui lòng kiểm tra lịch thi và phòng thi trên Cổng thông tin sinh viên trước ngày 01/06/2026.\n\nLưu ý: Sinh viên cần mang theo thẻ sinh viên hoặc CCCD khi dự thi. Không chấp nhận giấy tờ hết hạn.',
    'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&q=80',
    'thong-bao',
    '2026-05-22 09:00:00+07',
    5   -- Phòng Công tác Sinh viên
),

-- ── TIN TỨC ───────────────────────────────────────────────────────────────────
(
    'TVU lọt Top 10 Đại học xanh Việt Nam 2026',
    E'Đại học Trà Vinh chính thức được xếp hạng trong Top 10 Đại học Xanh tại Việt Nam năm 2026 theo bảng xếp hạng GreenMetric.\n\nThành tích này ghi nhận nỗ lực phát triển không gian xanh, tiết kiệm năng lượng và quản lý chất thải bền vững của nhà trường trong nhiều năm qua.',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80',
    'tin-tuc',
    '2026-05-28 10:00:00+07',
    21  -- Sân cỏ nhân tạo (biểu trưng cho không gian xanh khuôn viên)
),
(
    'Sinh viên TVU đạt giải Nhất cuộc thi Lập trình AI Quốc gia 2026',
    E'Đội tuyển sinh viên Khoa Công nghệ Thông tin Đại học Trà Vinh xuất sắc giành giải Nhất tại cuộc thi Lập trình Trí tuệ Nhân tạo Quốc gia 2026 tổ chức tại Hà Nội.\n\nDự án của đội tập trung vào ứng dụng mô hình học sâu để dự báo tình trạng giao thông đô thị, được hội đồng đánh giá cao về tính ứng dụng thực tiễn.',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
    'tin-tuc',
    '2026-05-20 14:30:00+07',
    10  -- Tòa nhà C5 (Khoa Kỹ thuật và Công nghệ – CNTT)
),
(
    'Hợp tác quốc tế: TVU ký kết MOU với Đại học Khon Kaen, Thái Lan',
    E'Đại học Trà Vinh vừa ký kết Biên bản ghi nhớ hợp tác (MOU) với Đại học Khon Kaen (Thái Lan) trong các lĩnh vực trao đổi sinh viên, nghiên cứu khoa học chung và phát triển chương trình đào tạo song ngữ.\n\nThỏa thuận có hiệu lực từ tháng 6/2026, mở ra cơ hội cho sinh viên hai trường tham gia các chương trình trao đổi ngắn hạn và dài hạn.',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
    'tin-tuc',
    '2026-05-15 08:00:00+07',
    4   -- Tòa nhà A1 (Khu hiệu bộ – nơi ký kết MOU)
),

-- ── SỰ KIỆN ───────────────────────────────────────────────────────────────────
(
    'Ngày hội việc làm – Job Fair TVU 2026',
    E'Ngày hội việc làm TVU 2026 quy tụ hơn 50 doanh nghiệp uy tín trong và ngoài tỉnh, với hàng ngàn vị trí tuyển dụng cho sinh viên năm cuối và cựu sinh viên.\n\nCác hoạt động bao gồm: phỏng vấn trực tiếp, hội thảo kỹ năng mềm, và triển lãm ngành nghề.\n\nThời gian: 8:00 – 17:00 ngày 15/06/2026\nĐịa điểm: Hội trường Lớn – Tòa B, Đại học Trà Vinh',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
    'su-kien',
    '2026-06-15 07:30:00+07',
    1   -- Tòa nhà B1 (Khoa Kinh tế - Luật và Ngoại ngữ)
),
(
    'Hội thảo Ứng dụng GIS trong Quản lý Đô thị',
    E'Hội thảo khoa học quốc gia với chủ đề "Ứng dụng Hệ thống Thông tin Địa lý (GIS) trong quy hoạch và quản lý đô thị thông minh" sẽ diễn ra tại Trường ĐH Trà Vinh.\n\nĐây là cơ hội để sinh viên ngành CNTT, Địa lý và Quy hoạch giao lưu với các chuyên gia hàng đầu.\n\nThời gian: 8:00 – 12:00 ngày 20/05/2026\nĐịa điểm: Phòng hội thảo – Tòa C',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'su-kien',
    '2026-05-20 08:00:00+07',
    10  -- Tòa nhà C5 (Khoa Kỹ thuật và Công nghệ)
),
(
    'Lễ trao bằng tốt nghiệp đợt 1 năm 2026',
    E'Lễ trao bằng tốt nghiệp đợt 1 năm học 2025–2026 sẽ được tổ chức trọng thể tại Nhà thi đấu đa năng Đại học Trà Vinh.\n\nSinh viên tốt nghiệp vui lòng đăng ký tham dự trước ngày 25/05/2026 qua Cổng thông tin sinh viên.\n\nThời gian: 7:30 – 11:30 ngày 01/06/2026\nĐịa điểm: Nhà thi đấu đa năng, Đại học Trà Vinh',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
    'su-kien',
    '2026-06-01 07:00:00+07',
    4   -- Tòa nhà A1 (Khu hiệu bộ – nơi tổ chức lễ chính thức)
),
(
    'Cuộc thi Hackathon TVU 2026 – Chủ đề Smart Campus',
    E'Phòng CNTT phối hợp Khoa CNTT tổ chức cuộc thi lập trình 24 giờ Hackathon TVU 2026 với chủ đề "Giải pháp công nghệ cho Khuôn viên thông minh".\n\nĐối tượng tham gia: Sinh viên tất cả các ngành, tối đa 4 thành viên/đội.\nGiải thưởng: Giải Nhất 10.000.000đ | Nhì 5.000.000đ | Ba 2.000.000đ.\n\nThời gian: 7:00 ngày 10/06 – 7:00 ngày 11/06/2026\nĐịa điểm: Phòng máy tính – Tòa A, tầng 2',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
    'su-kien',
    '2026-06-10 07:00:00+07',
    10  -- Tòa nhà C5 (Khoa Kỹ thuật và Công nghệ – Phòng máy tính)
),
(
    'Tuần lễ Văn hóa các dân tộc Đồng bằng Sông Cửu Long 2026',
    E'Đại học Trà Vinh tổ chức Tuần lễ Văn hóa các dân tộc Đồng bằng Sông Cửu Long lần thứ 5 nhân kỷ niệm ngày thành lập trường.\n\nCác hoạt động: triển lãm văn hóa Khmer – Kinh – Hoa, biểu diễn nghệ thuật dân gian, hội chợ ẩm thực vùng miền và giao lưu thể thao.\n\nThời gian: 25/05 – 30/05/2026\nĐịa điểm: Sân vận động và khu vực trung tâm khuôn viên TVU',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    'su-kien',
    '2026-05-25 07:00:00+07',
    35  -- Tòa nhà E3 (Khoa Ngôn ngữ - Văn hóa - Nghệ thuật Khmer Nam Bộ)
);
