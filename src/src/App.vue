<template>
  <!-- Vue Router sẽ render Homepage, Mappage hoặc Adminpage vào đây -->
  <router-view />
</template>

<script setup>
// App.vue là root component tối giản.
// Toàn bộ logic điều hướng (kể cả chặn Mobile vào Homepage)
// được xử lý bởi Navigation Guard trong routes/indexRoutes.js
</script>
