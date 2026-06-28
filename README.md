# Phát triển ứng dụng bản đồ số hỗ trợ sinh viên tìm phòng học trong khuôn viên Đại học Trà Vinh

---

## Mục Tiêu

- [Mục Tiêu](#-mục-tiêu)
- [Tính Năng Chính](#-tính-năng-chính)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Yêu Cầu Phần Mềm](#-yêu-cầu-phần-mềm)
- [Hướng Dẫn Triển Khai](#-hướng-dẫn-triển-khai)
  - [Chạy bằng Docker (Khuyến nghị)](#1-chạy-bằng-docker-khuyến-nghị)
  - [Chạy thủ công (Môi trường phát triển)](#2-chạy-thủ-công-môi-trường-phát-triển)
- [Biến Môi Trường](#-biến-môi-trường)
- [API Endpoints](#-api-endpoints)

---

## Mục Tiêu

Đồ án hướng đến xây dựng một **hệ thống bản đồ số** phục vụ sinh viên, giảng
viên và khách tham quan Trường Đại học Trà Vinh với các mục tiêu cụ thể:

| Mục tiêu                 | Mô tả                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Số hóa khuôn viên**    | Hiển thị bản đồ tương tác của toàn bộ campus TVU với các mốc địa điểm (buildings, phòng học, tiện ích).               |
| **Tìm kiếm thông minh**  | Cho phép người dùng tìm kiếm nhanh các địa điểm (landmark), tòa nhà và phòng học theo tên.                            |
| **Chỉ đường nội bộ**     | Tính toán và hiển thị tuyến đường ngắn nhất trong khuôn viên trường dựa trên thuật toán A\*.                          |
| **Tin tức & Sự kiện**    | Cung cấp thông tin tin tức, thông báo nội bộ của nhà trường ngay trên nền tảng bản đồ.                                |
| **Quản trị nội dung**    | Cung cấp trang Admin để quản lý địa điểm, tin tức, tuyến đường và cập nhật dữ liệu theo thời gian thực qua WebSocket. |
| **Triển khai Container** | Đóng gói toàn bộ hệ thống bằng Docker để dễ dàng triển khai, mở rộng và tái sử dụng.                                  |

---

## Tính Năng Chính

- **Bản đồ tương tác** dựa trên Leaflet.js với tile map tùy chỉnh
- **Thanh tìm kiếm** hỗ trợ tìm kiếm Landmark và Phòng học theo nhóm
- **Chỉ đường A\*** – Tìm đường ngắn nhất trong khuôn viên trường
- **Chi tiết địa điểm** – Xem thông tin, hình ảnh từng tòa nhà, phòng học
- **Tin tức & Sự kiện** – Đọc bài viết, thông báo của trường
- **Trang Admin** – Quản lý toàn bộ nội dung (CRUD Landmarks, Roads, News)
- **WebSocket** – Đồng bộ dữ liệu thời gian thực giữa Admin và các client
- **Responsive** – Giao diện tương thích đa thiết bị

---

## Kiến Trúc Hệ Thống

Hệ thống được xây dựng theo mô hình **3 tầng (Three-Tier Architecture)** và
triển khai dưới dạng **microservices** qua Docker Compose.

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│                  Vue 3 SPA + Leaflet.js                  │
│           http://localhost:5173  (Development)           │
│           http://localhost:80    (Production)            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
         ┌─────────────▼──────────────┐
         │       Nginx Reverse Proxy   │  (Production only)
         │         Port 80             │
         └──────┬──────────┬──────────┘
                │ /api     │ /ws
   ┌────────────▼──────────▼────────────┐
   │         Backend (Express.js)        │
   │     Node.js + WebSocket Server      │
   │          Port 3000                  │
   │                                     │
   │  Routes:                            │
   │  ├── /api/landmarks                 │
   │  ├── /api/paths                     │
   │  ├── /api/news                      │
   │  ├── /api/rooms                     │
   │  ├── /api/admin/config              │
   │  └── /api/ws/*  (WS control)        │
   └────────────────┬───────────────────┘
                    │ SQL (postgres driver)
   ┌────────────────▼───────────────────┐
   │   PostgreSQL 15 + PostGIS + pgRouting│
   │           Port 5432                  │
   │   (pgrouting/pgrouting:15-3.5-4.0)   │
   └─────────────────────────────────────┘
```

### Luồng dữ liệu chỉ đường

```
User chọn điểm A & B
        │
        ▼
Frontend gọi POST /api/paths/find
        │
        ▼
Backend truy vấn graph tuyến đường từ DB
        │
        ▼
Thuật toán A* (astar.js) tính đường ngắn nhất
        │
        ▼
Trả về danh sách tọa độ GeoJSON → Leaflet vẽ lên bản đồ
```

### Luồng cập nhật thời gian thực (WebSocket)

```
Admin thực hiện thay đổi (thêm/sửa/xóa)
        │
        ▼
Backend lưu DB → broadcast() qua WebSocket
        │
        ▼
Tất cả Client nhận event → tự động reload/cập nhật UI
```

---

## Công Nghệ Sử Dụng

### Frontend

| Công nghệ      | Phiên bản | Mô tả                                  |
| -------------- | --------- | -------------------------------------- |
| **Vue 3**      | ^3.5      | Framework JavaScript (Composition API) |
| **Vue Router** | ^5.0      | Điều hướng SPA (Hash Router)           |
| **Leaflet.js** | ^1.9.4    | Thư viện bản đồ tương tác              |
| **Vite**       | ^8.0      | Build tool & Dev server                |
| **VueQuill**   | ^1.0      | Rich text editor cho Admin             |

### Backend

| Công nghệ      | Phiên bản | Mô tả                                        |
| -------------- | --------- | -------------------------------------------- |
| **Node.js**    | 20+       | Runtime JavaScript                           |
| **Express.js** | ^5.2      | Web framework                                |
| **ws**         | ^8.21     | WebSocket Server                             |
| **postgres**   | ^3.4      | PostgreSQL client (tagged template literals) |
| **multer**     | ^2.1      | Upload file (ảnh địa điểm, tin tức)          |
| **dotenv**     | ^17       | Quản lý biến môi trường                      |

### Cơ sở dữ liệu

| Công nghệ      | Phiên bản | Mô tả                                       |
| -------------- | --------- | ------------------------------------------- |
| **PostgreSQL** | 15        | Hệ quản trị CSDL quan hệ                    |
| **PostGIS**    | 3.5       | Extension xử lý dữ liệu không gian địa lý   |
| **pgRouting**  | 4.0       | Extension tính toán tuyến đường trên đồ thị |

### Hạ tầng & DevOps

| Công nghệ          | Mô tả                                            |
| ------------------ | ------------------------------------------------ |
| **Docker**         | Container hóa từng service                       |
| **Docker Compose** | Orchestration đa container                       |
| **Nginx**          | Reverse proxy + phục vụ static file (Production) |

---

## Yêu Cầu Phần Mềm

| Phần mềm           | Phiên bản tối thiểu | Link tải                                                                              |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------- |
| **Docker Desktop** | 24.0+               | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2.20+              | Tích hợp sẵn trong Docker Desktop                                                     |

> **Không cần cài Node.js hay PostgreSQL** khi sử dụng Docker.

---

## Hướng Dẫn Triển Khai

#### Bước 1: Clone repository và chuẩn bị môi trường

```bash
# Clone project
git clone <repository-url>
cd tn-da22tta-maitranthanhnhat-bandosodhtv/src

# Tạo file .env từ mẫu
cp .env.example .env
```

#### Bước 2: Chỉnh sửa file `.env`

```env
PORT=3000
NODE_ENV=development
DB_HOST=db           # Giữ nguyên "db" khi dùng Docker
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_strong_password_here
DB_SSL=false
```

#### Bước 3: Khởi động toàn bộ hệ thống

```bash
# Môi trường Development (có hot-reload)
docker compose up --build

# Chạy nền (detached)
docker compose up --build -d
```

#### Bước 4: Truy cập ứng dụng

| Dịch vụ                        | URL                              |
| ------------------------------ | -------------------------------- |
| **Frontend** (Vite dev server) | http://localhost:5173            |
| **Backend API**                | http://localhost:3000/api/status |
| **WebSocket**                  | ws://localhost:3000/ws           |
| **Database**                   | localhost:5432                   |

> **Lưu ý:** Lần đầu khởi động, Docker sẽ tự động:
>
> - Pull image `pgrouting/pgrouting:15-3.5-4.0` (~500MB)
> - Chạy `schema/init.sql` để tạo bảng và import dữ liệu mẫu
> - Cài `node_modules` bên trong container

#### Dừng hệ thống

```bash
# Dừng container
docker compose down

# Dừng và xóa toàn bộ data (reset DB)
docker compose down -v
```

#### Triển khai Production

```bash
# Build và chạy với Nginx reverse proxy
docker compose -f docker-compose.prod.yml up --build -d
```

Sau khi chạy Production, ứng dụng sẽ phục vụ tại **http://localhost:80**.

---

## Biến Môi Trường .env

| Biến          | Mặc định      | Mô tả                                                              |
| ------------- | ------------- | ------------------------------------------------------------------ |
| `PORT`        | `3000`        | Cổng chạy Backend                                                  |
| `NODE_ENV`    | `development` | Môi trường (`development` / `production`)                          |
| `DB_HOST`     | `db`          | Host PostgreSQL (`db` trong Docker, `localhost` khi chạy thủ công) |
| `DB_PORT`     | `5432`        | Cổng PostgreSQL                                                    |
| `DB_NAME`     | `postgres`    | Tên database                                                       |
| `DB_USER`     | `postgres`    | Tên người dùng DB                                                  |
| `DB_PASSWORD` | _(bắt buộc)_  | Mật khẩu DB                                                        |
| `DB_SSL`      | `false`       | Bật/tắt SSL kết nối DB                                             |

---

## API Endpoints

### Landmarks (Địa điểm)

| Method   | Endpoint             | Mô tả                   |
| -------- | -------------------- | ----------------------- |
| `GET`    | `/api/landmarks`     | Lấy tất cả địa điểm     |
| `GET`    | `/api/landmarks/:id` | Lấy chi tiết 1 địa điểm |
| `POST`   | `/api/landmarks`     | Thêm địa điểm mới       |
| `PUT`    | `/api/landmarks/:id` | Cập nhật địa điểm       |
| `DELETE` | `/api/landmarks/:id` | Xóa địa điểm            |

### Paths (Tuyến đường & Chỉ đường)

| Method | Endpoint          | Mô tả                                 |
| ------ | ----------------- | ------------------------------------- |
| `GET`  | `/api/paths`      | Lấy tất cả node/edge tuyến đường      |
| `POST` | `/api/paths/find` | Tìm đường ngắn nhất (A\*) giữa 2 điểm |

### News (Tin tức)

| Method   | Endpoint        | Mô tả                 |
| -------- | --------------- | --------------------- |
| `GET`    | `/api/news`     | Lấy danh sách tin tức |
| `GET`    | `/api/news/:id` | Lấy chi tiết bài viết |
| `POST`   | `/api/news`     | Tạo bài viết mới      |
| `PUT`    | `/api/news/:id` | Cập nhật bài viết     |
| `DELETE` | `/api/news/:id` | Xóa bài viết          |

### Rooms (Phòng học)

| Method | Endpoint         | Mô tả                   |
| ------ | ---------------- | ----------------------- |
| `GET`  | `/api/rooms`     | Lấy danh sách phòng học |
| `GET`  | `/api/rooms/:id` | Lấy chi tiết phòng học  |

### WebSocket Control

| Method | Endpoint           | Mô tả                                 |
| ------ | ------------------ | ------------------------------------- |
| `GET`  | `/api/ws/status`   | Số client đang kết nối                |
| `POST` | `/api/ws/reload`   | Yêu cầu tất cả client tải lại trang   |
| `POST` | `/api/ws/navigate` | Chuyển hướng tất cả client            |
| `POST` | `/api/ws/notify`   | Gửi thông báo toast tới tất cả client |

### Health Check

| Method | Endpoint      | Mô tả                            |
| ------ | ------------- | -------------------------------- |
| `GET`  | `/api/status` | Kiểm tra trạng thái server và DB |

---

## Thông Tin Đồ Án

|                         |                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| **Tên đồ án**           | Phát triển ứng dụng bản đồ số hỗ trợ sinh viên tìm phòng học trong khuôn viên Đại học Trà Vinh |
| **Sinh viên thực hiện** | Mai Trần Thành Nhật                                                                            |
| **Trường**              | Đại học Trà Vinh                                                                               |
| **Năm thực hiện**       | 2026                                                                                           |
