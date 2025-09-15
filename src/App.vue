<template>
  <div class="page">
    <main class="content">
      <transition name="switch" mode="out-in">
        <Salutation v-if="salutation" key="salutation" />
        <InitialSetup v-else key="setup" />
      </transition>
    </main>

    <footer class="footer">
      <p class="footer__title">IT Лаборатория. 2025</p>
    </footer>
  </div>
</template>

<script>
import Salutation from '@/components/Salutation.vue';
import InitialSetup from '@/components/InitialSetup.vue';

export default {
  data() {
    return { salutation: true }
  },
  mounted() {
    setTimeout(() => { this.salutation = false }, 3000)
  },
  components: { Salutation, InitialSetup }
}
</script>

<style>
.page {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}
.content {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 16px;
}


.switch-enter-active,
.switch-leave-active {
  transition: opacity .45s cubic-bezier(.22,1,.36,1),
              transform .45s cubic-bezier(.22,1,.36,1);
  will-change: opacity, transform;
}
.switch-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(.98);   
}
.switch-enter-to {
  opacity: 1;
  transform: none;
}
.switch-leave-from {
  opacity: 1;
  transform: none;
}
.switch-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(.98); 
}


.footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.footer__title {
  width: 190px;
  padding: 30px 20px;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-family: "Source Sans 3", sans-serif;
  cursor: default;
}


@media (prefers-reduced-motion: reduce) {
  .switch-enter-active, .switch-leave-active { transition: none !important; }
  .switch-enter-from, .switch-leave-to { transform: none !important; opacity: 1 !important; }
}
</style>
