# ─────────────────────────────────────────
# Stage 1: Installer
# Mục đích: Chỉ cài đặt production dependencies, dọn npm cache
# ─────────────────────────────────────────
FROM node:20-alpine AS installer

WORKDIR /app

# Copy manifest trước → tận dụng layer cache:
# Layer này chỉ rebuild khi package.json hoặc package-lock.json thay đổi
COPY package.json package-lock.json ./

# npm ci: cài đúng version theo lock file, nhanh hơn npm install
# --omit=dev: bỏ devDependencies (nodemon, etc.)
RUN npm ci --omit=dev \
    && npm cache clean --force


# ─────────────────────────────────────────
# Stage 2: Runner
# Mục đích: Image runtime thuần túy, không có npm, cache, hay rác
# ─────────────────────────────────────────
FROM node:20-alpine AS runner

# Thêm dumb-init để xử lý tín hiệu Unix đúng cách (SIGTERM, SIGINT)
# Đặc biệt quan trọng với WebSocket connections
RUN apk add --no-cache dumb-init

WORKDIR /app

# Tạo user non-root để tăng bảo mật
RUN addgroup -g 1001 -S nodejs \
    && adduser  -S nodeuser -u 1001 -G nodejs

# Copy node_modules đã được làm sạch từ Stage 1
COPY --from=installer --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy chỉ các file source code backend cần thiết.
# Chỉ liệt kê tường minh từng thư mục/file cần thiết → các file rác
# (.git, README.md, schema/, src/, Dockerfile*, ...) vốn dĩ KHÔNG bao giờ
# lọt vào Stage 2 này. Do đó KHÔNG cần thêm lệnh RUN rm -rf ... vì:
#   1. Không có gì để xóa.
#   2. Thêm rm -rf vào file không tồn tại sẽ làm BUILD LỖI.
COPY --chown=nodeuser:nodejs server.js        ./
COPY --chown=nodeuser:nodejs config/          ./config/
COPY --chown=nodeuser:nodejs controllers/     ./controllers/
COPY --chown=nodeuser:nodejs routes/          ./routes/
COPY --chown=nodeuser:nodejs models/          ./models/
COPY --chown=nodeuser:nodejs middleware/      ./middleware/

# Tạo thư mục uploads (sẽ được override bởi volume trong compose)
RUN mkdir -p public/uploads && chown -R nodeuser:nodejs public/

USER nodeuser

EXPOSE 3000

# dumb-init đảm bảo graceful shutdown cho WebSocket
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
