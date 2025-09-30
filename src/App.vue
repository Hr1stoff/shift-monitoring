<template>
  <div class="page">

    <button class="settings-btn" type="button" aria-label="Открыть настройки" @click="openSettings">
      <svg viewBox="0 0 32 32" aria-hidden="true" class="settings-icon">
        <path class="cls-1"
          d="M17,31H15a3,3,0,0,1-3-2.64,12.68,12.68,0,0,1-1.95-.8,3,3,0,0,1-4-.25L4.69,25.9a3,3,0,0,1-.25-4A12.68,12.68,0,0,1,3.64,20,3,3,0,0,1,1,17V15a3,3,0,0,1,2.64-3,12.68,12.68,0,0,1,.8-1.95,3,3,0,0,1,.25-4L6.1,4.69a3,3,0,0,1,4-.25A12.68,12.68,0,0,1,12,3.64,3,3,0,0,1,15,1h2a3,3,0,0,1,3,2.64,12.68,12.68,0,0,1,1.95.8,3,3,0,0,1,4,.25L27.31,6.1a3,3,0,0,1,.25,4,12.68,12.68,0,0,1,.8,1.95A3,3,0,0,1,31,15v2a3,3,0,0,1-2.64,3,12.68,12.68,0,0,1-.8,1.95,3,3,0,0,1-.25,4L25.9,27.31a3,3,0,0,1-4,.25,12.68,12.68,0,0,1-1.95.8A3,3,0,0,1,17,31ZM9.91,25.33a.94.94,0,0,1,.51.14,11,11,0,0,0,2.83,1.17,1,1,0,0,1,.75,1V28a1,1,0,0,0,1,1h2a1,1,0,0,0,1-1v-.39a1,1,0,0,1,.75-1,11,11,0,0,0,2.83-1.17,1,1,0,0,1,1.21.15l.28.28a1,1,0,0,0,1.42,0l1.41-1.41a1,1,0,0,0,0-1.42l-.28-.28a1,1,0,0,1-.15-1.21,11,11,0,0,0,1.17-2.83,1,1,0,0,1,1-.75H28a1,1,0,0,0,1-1V15a1,1,0,0,0-1-1h-.39a1,1,0,0,1-1-.75,11,11,0,0,0-1.17-2.83,1,1,0,0,1,.15-1.21l.28-.28a1,1,0,0,0,0-1.42L24.49,6.1a1,1,0,0,0-1.42,0l-.28.28a1,1,0,0,1-1.21.15,11,11,0,0,0-2.83-1.17,1,1,0,0,1-.75-1V4a1,1,0,0,0-1-1H15a1,1,0,0,0-1,1v.39a1,1,0,0,1-.75,1,11,11,0,0,0-2.83,1.17,1,1,0,0,1-1.21-.15L8.93,6.1a1,1,0,0,0-1.42,0L6.1,7.51a1,1,0,0,0,0,1.42l.28.28a1,1,0,0,1,.15,1.21,11,11,0,0,0-1.17,2.83,1,1,0,0,1-1,.75H4a1,1,0,0,0-1,1v2a1,1,0,0,0,1,1h.39a1,1,0,0,1,1,.75,11,11,0,0,0,1.17,2.83,1,1,0,0,1-.15,1.21l-.28.28a1,1,0,0,0,0,1.42L7.51,25.9a1,1,0,0,0,1.42,0l.28-.28A1,1,0,0,1,9.91,25.33Z" />
        <path class="cls-1" d="M16,23a7,7,0,1,1,7-7A7,7,0,0,1,16,23Zm0-12a5,5,0,1,0,5,5A5,5,0,0,0,16,11Z" />
      </svg>
    </button>


    <main class="content">
      <transition name="switch" mode="out-in">
        <Salutation v-if="salutation" key="salutation" />
        <InitialSetup v-else key="setup" />
      </transition>
    </main>




    <teleport to="body">
      <div v-if="isSettingsOpen" class="settings-backdrop" @click.self="closeSettings" @keydown.esc="closeSettings"
        tabindex="-1" role="dialog" aria-modal="true" aria-label="Настройки">
        <div class="settings-modal">
          <button class="modal-close" type="button" aria-label="Закрыть" @click="closeSettings">✕</button>

          <button class="danger-chip" type="button" @click="resetStore">
            Сбросить магазин
          </button>
        </div>
      </div>
    </teleport>


    <footer class="footer">
      <p class="footer__title">IT Лаборатория. 2025</p>
    </footer>
  </div>
</template>

<script>
import Salutation from '@/components/Salutation.vue';
import InitialSetup from '@/components/InitialSetup.vue';
import api from "@/service/api";
export default {
  data() {
    return {
      salutation: true,
      stores: null,
      isSettingsOpen: false,
    }
  },
  created() {
    this.getStores();
  },
  mounted() {
    setTimeout(() => { this.salutation = false }, 3000)
  },
  components: { Salutation, InitialSetup },
  methods: {
    async getStores() {
      try {
   
        let cached = null;
        try {
          const raw = localStorage.getItem("stores");
          if (raw) cached = JSON.parse(this.b64DecodeUnicode(raw));
        } catch { cached = null }

        if (cached) {
          this.stores = cached.data;
        }

 
        const meta = await api.get("/api/stores/meta");
        const updatedAt = meta.data.updated_at;


        if (!cached || cached.updated_at !== updatedAt) {
          const response = await api.get("/api/stores");
          this.stores = response.data.data;
          const payload = {
            updated_at: updatedAt,
            data: this.stores
          };
          localStorage.setItem("stores", this.b64EncodeUnicode(JSON.stringify(payload)));
        }

      } catch (err) {
        console.log("Ошибка при загрузке магазинов:", err);
      }
    },
    openSettings() { this.isSettingsOpen = true; },
    closeSettings() { this.isSettingsOpen = false; },

    resetStore() {
      try {
        localStorage.removeItem('qr_store_id_enc');
      } catch (e) { /* no-op */ }
      window.location.reload();
    },
    b64EncodeUnicode(str) {
      return btoa(unescape(encodeURIComponent(str)));
    },
    b64DecodeUnicode(str) {
      return decodeURIComponent(escape(atob(str)));
    },


  }
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
  transition: opacity .45s cubic-bezier(.22, 1, .36, 1),
    transform .45s cubic-bezier(.22, 1, .36, 1);
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

.settings-btn {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 1000;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 0;
  border: none;

  width: 60px;
  height: 60px;

  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.settings-icon {
  width: 40px;
  height: 40px;
  display: block;
}

.settings-icon .cls-1 {
  fill: #DFD5D0;
}


.settings-btn:active {
  transform: translateY(1px);
}

.settings-btn:focus-visible {
  outline: 3px solid rgba(223, 213, 208, .5);
  outline-offset: 2px;
}



/* затемнённый фон с размытием */
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(6px);
}

/* стеклянная панель */
.settings-modal {
  position: relative;
  width: min(680px, 92vw);
  min-height: 240px;
  padding: 24px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  /* iOS */
}

/* крестик в правом верхнем углу */
.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #56C5C9;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
}

.danger-chip {
  display: inline-block;
  padding: 15px 16px;
  border: 0;
  border-radius: 12px;
  background: #E63A33;
  color: #fff;
  font: 500 16px/1.2 "Montserrat", system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(230, 58, 51, .25);
}

.danger-chip:hover {
  filter: brightness(1.03);
}

.danger-chip:active {
  transform: translateY(1px);
}

.danger-chip:focus-visible {
  outline: 3px solid rgba(230, 58, 51, .35);
  outline-offset: 2px;
}


.settings-backdrop {
  animation: fade-in .2s ease;
}

.settings-modal {
  animation: pop-in .25s cubic-bezier(.22, 1, .36, 1);
}

@keyframes fade-in {
  from {
    opacity: 0
  }

  to {
    opacity: 1
  }
}

@keyframes pop-in {
  from {
    transform: translateY(6px) scale(.98);
    opacity: .9
  }

  to {
    transform: none;
    opacity: 1
  }
}

@media (prefers-reduced-motion: reduce) {

  .settings-backdrop,
  .settings-modal {
    animation: none !important;
  }
}


@media (prefers-reduced-motion: reduce) {

  .settings-btn,
  .settings-btn:active {
    transform: none !important;
  }
}


@media (prefers-reduced-motion: reduce) {

  .switch-enter-active,
  .switch-leave-active {
    transition: none !important;
  }

  .switch-enter-from,
  .switch-leave-to {
    transform: none !important;
    opacity: 1 !important;
  }
}
</style>
