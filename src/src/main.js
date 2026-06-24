import { createApp } from 'vue'
import { initWebSocket } from './wsClient.js'
import router from '../routes/indexRoutes.js'
import App from './App.vue'

// Khởi động WebSocket client (tự động reconnect)
initWebSocket()

// Tạo Vue app với Vue Router — Navigation Guard sẽ tự động kiểm tra mọi lượt truy cập
createApp(App)
  .use(router)
  .mount('#app')
