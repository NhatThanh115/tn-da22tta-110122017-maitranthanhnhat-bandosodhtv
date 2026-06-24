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