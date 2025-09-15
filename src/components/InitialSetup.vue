<template>
  <section class="form" v-cloak>
    <div class="container">
      <transition name="panel" mode="out-in">
        <!-- ФОРМА -->
        <form v-if="step === 'form' && !persisted" key="form" class="form__wrapper" @submit.prevent="onGenerate">
          <input type="text" placeholder="Введите номер магазина (например: 1001)" class="form__input"
            @keyup.enter="onGenerate" v-model="storeIdInput" />
          <input class="form__button" type="button" value="Сгенерировать QR" @click="onGenerate" />
        </form>

        <!-- QR ПАНЕЛЬ -->
        <div v-else key="qr" class="qr__wrapper">
          <div class="qr_title-wrap">
            <h2 class="qr__title reveal-down">Сканируйте QR-код</h2>
            <p class="qr__subtitle reveal-down delay">
              Отсканируйте QR код в телеграме БОТ-ИНФОРМАТОР для начала смены.
            </p>
          </div>

          <div class="qr_hero">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="qr__img qr-pop-in" />
            <p v-if="error" class="qr__err">{{ error }}</p>
          </div>
          <!-- Кнопку «изменить магазин» намеренно не показываем, т.к. форма не должна возвращаться -->
        </div>
      </transition>
    </div>
  </section>
</template>

<script>
import QRCode from 'qrcode'

export default {
  name: 'QrLanding',
  data() {
    // До первого рендера проверяем LS — это убирает «вспышку» формы
    let hasStore = false
    try { hasStore = !!localStorage.getItem('qr_store_id_enc') } catch { hasStore = false }

    return {
      step: hasStore ? 'qr' : 'form',
      persisted: hasStore,        // если true — форму больше не показываем
      storeIdInput: '',
      qrDataUrl: '',
      error: '',
      timer: null,
      _rsaPubKey: null,

      // Константы
      APP_SECRET: 'qr-landing-app-secret-v1',
      QR_TTL_SECONDS: 10,
    }
  },

  async mounted() {
    try {
      // 1) Загружаем публичный ключ для шифрования
      const pem = await fetch('/scanner_public.pem').then(r => {
        if (!r.ok) throw new Error('scanner_public.pem not found')
        return r.text()
      })
      this._rsaPubKey = await this.importRsaPublicKey(pem)

      // 2) Если стартовали в режиме QR — подтверждаем восстановление и запускаем генерацию
      if (this.persisted) {
        const restored = await this.loadStoreIdEncrypted()
        if (restored) {
          this.storeIdInput = restored
          await this.generateQrOnce()
          this.startTicker()
        } else {
          // В LS что-то было, но расшифровать не вышло — возвращаем форму (редкий случай)
          this.persisted = false
          this.step = 'form'
        }
      }
    } catch (e) {
      this.error = e?.message || 'Не удалось загрузить публичный ключ'
    }
  },

  beforeUnmount() {
    this.stopTicker()
  },

  methods: {
    // ───── base64url ─────
    b64uEnc(buf) {
      let s = btoa(String.fromCharCode(...new Uint8Array(buf)))
      return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    },
    b64uDec(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/')
      const pad = str.length % 4 ? 4 - (str.length % 4) : 0
      const s = atob(str + '='.repeat(pad))
      const u8 = new Uint8Array(s.length)
      for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
      return u8.buffer
    },

    // ───── RSA public key (PEM → CryptoKey) ─────
    async importRsaPublicKey(pem) {
      const text = pem.trim()
      if (!text.includes('-----BEGIN PUBLIC KEY-----') || !text.includes('-----END PUBLIC KEY-----')) {
        throw new Error('Invalid PEM: missing header/footer')
      }
      const lines = text.split(/\r?\n/)
      const body = lines.slice(1, -1).join('')
      const pad = body.length % 4 ? 4 - (body.length % 4) : 0
      const b64 = body + '='.repeat(pad)
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const der = bytes.buffer

      return window.crypto.subtle.importKey(
        'spki',
        der,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      )
    },

    // ───── AES-GCM для localStorage ─────
    async deriveLocalKey() {
      const enc = new TextEncoder()
      const baseKey = await  window.crypto.subtle.importKey(
        'raw', enc.encode(this.APP_SECRET), { name: 'PBKDF2' }, false, ['deriveKey']
      )
      return window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('qr-landing-salt'), iterations: 200000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    },

    async saveStoreIdEncrypted(storeId) {
      const key = await this.deriveLocalKey()
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const pt = new TextEncoder().encode(storeId)
      const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt)
      const payload = `${this.b64uEnc(iv)}.${this.b64uEnc(ct)}`
      localStorage.setItem('qr_store_id_enc', payload)
    },

    async loadStoreIdEncrypted() {
      const payload = localStorage.getItem('qr_store_id_enc')
      if (!payload) return null
      try {
        const [ivB64, ctB64] = payload.split('.')
        const key = await this.deriveLocalKey()
        const pt = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(this.b64uDec(ivB64)) },
          key,
          this.b64uDec(ctB64)
        )
        return new TextDecoder().decode(pt)
      } catch {
        return null
      }
    },

    // ───── «JWE»-подобная упаковка полезной нагрузки ─────
    async jweEncrypt(publicKey, plaintextObj) {
      const cek = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const plaintext = new TextEncoder().encode(JSON.stringify(plaintextObj))
      const ciphertextBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cek, plaintext)
      const cekRaw = await window.crypto.subtle.exportKey('raw', cek)
      const encKeyBuf = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, cekRaw)
      const header = { alg: 'RSA-OAEP', enc: 'A256GCM', typ: 'JWE' }
      const compact = [
        this.b64uEnc(new TextEncoder().encode(JSON.stringify(header))),
        this.b64uEnc(encKeyBuf),
        this.b64uEnc(iv),
        this.b64uEnc(ciphertextBuf),
        ''
      ].join('.')
      return compact
    },

    // ───── Генерация QR ─────
    async generateQrOnce() {
      try {
        this.error = ''
        if (!this._rsaPubKey) return

        const storeId = (this.storeIdInput || '').trim()
        if (!storeId) return

        const now = Math.floor(Date.now() / 1000)
        const payload = {
          v: 1,
          store_id: storeId,
          ts: now,
          exp: now + this.QR_TTL_SECONDS,
          nonce: this.b64uEnc(window.crypto.getRandomValues(new Uint8Array(12))),
        }

        const compact = await this.jweEncrypt(this._rsaPubKey, payload)
        this.qrDataUrl = await QRCode.toDataURL(compact, {
          margin: 1,
          scale: 8,
          errorCorrectionLevel: 'M',
        })
      } catch (e) {
        this.error = e?.message || 'Ошибка генерации QR'
      }
    },

    // ───── Тикер ─────
    startTicker() {
      this.stopTicker()
      this.timer = setInterval(this.generateQrOnce, 1000)
    },
    stopTicker() {
      if (this.timer) { clearInterval(this.timer); this.timer = null }
    },

    // ───── UI ─────
    async onGenerate() {
      const v = (this.storeIdInput || '').trim()
      if (!v) return

      // Сохраняем и БОЛЬШЕ не возвращаем форму
      await this.saveStoreIdEncrypted(v)
      this.persisted = true
      this.step = 'qr'

      await this.generateQrOnce()
      this.startTicker()
    },

    // На всякий случай: если уже persist — игнорируем попытки ресета
    resetAll() {
      if (this.persisted) return
      this.stopTicker()
      this.qrDataUrl = ''
      this.step = 'form'
    },
  }
}
</script>

<style>
[v-cloak] {
  display: none;
}


html,
body {
  margin: 0;
  overflow-x: clip;
}

@supports not (overflow: clip) {

  html,
  body {
    overflow-x: hidden;
  }
}

.form {
  display: flex;
  align-items: center;
  border-radius: 16px;
  overflow-x: clip;
}


.panel-enter-active,
.panel-leave-active {
  transition:
    opacity .45s cubic-bezier(.22, 1, .36, 1),
    transform .45s cubic-bezier(.22, 1, .36, 1),
    filter .45s ease;
  will-change: opacity, transform, filter;
}

.panel-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(.98);
  filter: blur(4px);
}

.panel-enter-to {
  opacity: 1;
  transform: none;
  filter: blur(0);
}

.panel-leave-from {
  opacity: 1;
  transform: none;
  filter: blur(0);
}

.panel-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(.98);
  filter: blur(4px);
}

/* ===== ФОРМА ===== */
.form__wrapper {
  width: 870px;
  background-color: #fff;
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0;
}

.form__input {
  font-family: "Montserrat", sans-serif;
  font-size: 24px;
  width: 100%;
  height: 80px;
  padding: 0 25px;
  border-right: none;
  border-radius: 12px 0 0 12px;
  text-align: center;
  transition: border-color .3s ease;
  box-sizing: border-box;
}

.form__button {
  font-family: "Montserrat", sans-serif;
  font-size: 24px;
  transition: background-color .3s ease, transform .2s ease;
  width: 268px;
  height: 80px;
  color: #fff;
  border: none;
  border-radius: 0 16px 16px 0;
  background-color: #316EED;
  padding: 0 16px;
}

.form__button:active {
  transform: translateY(1px);
}

/* ===== QR ПАНЕЛЬ ===== */
.qr__wrapper {
  width: 500px;
  margin: 0 auto;
  background: rgba(255, 255, 255, .6);
  border-radius: 16px;
  padding: 48px 50px;
  text-align: center;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.qr__title {
  margin: 0 0 8px;
  font-weight: 600;
  font-family: "Montserrat", sans-serif;
  font-size: 32px;
}

.qr__subtitle {
  font-family: "Montserrat", sans-serif;
  opacity: .7;
  font-size: 16px;
}

.qr__img {
  width: 320px;
  height: 320px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
  background: #fff;
}

.qr__loading {
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
  opacity: .7;
  margin: 0 0 16px;
}

/* появление заголовков сверху-вниз */
.reveal-down {
  display: inline-block;
  clip-path: inset(0 0 100% 0);
  opacity: 0;
  transform: translateY(-6px);
  animation:
    wipe-down .8s cubic-bezier(.22, 1, .36, 1) forwards,
    fade-slide .6s cubic-bezier(.22, 1, .36, 1) forwards;
}

.reveal-down.delay {
  animation-delay: .12s, .12s;
}

@keyframes wipe-down {
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes fade-slide {
  to {
    opacity: 1;
    transform: none;
  }
}

/* лёгкое «всплытие» QR-кода */
.qr-pop-in {
  opacity: 0;
  transform: translateY(8px) scale(.98);
  animation: qr-in .45s cubic-bezier(.22, 1, .36, 1) .1s forwards;
}

@keyframes qr-in {
  to {
    opacity: 1;
    transform: none;
  }
}

.qr__err {
  color: #d92c20;
  margin: 0 0 16px;
  opacity: .8;
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
}

/* адаптив */
@media (max-width: 560px) {
  .form__wrapper {
    width: 100%;
  }

  .qr__wrapper {
    width: 100%;
    padding: 28px 24px;
  }

  .qr__img {
    width: 260px;
    height: 260px;
  }

  .qr__title {
    font-size: 26px;
  }
}

/* reduce-motion */
@media (prefers-reduced-motion: reduce) {

  .panel-enter-active,
  .panel-leave-active,
  .reveal-down,
  .qr-pop-in {
    animation: none !important;
    transition: none !important;
  }

  .reveal-down {
    opacity: 1;
    transform: none;
    clip-path: inset(0 0 0 0);
  }

  .qr-pop-in {
    opacity: 1;
    transform: none;
  }
}
</style>
