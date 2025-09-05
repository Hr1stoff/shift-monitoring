<template>
    <section class="form">
        <div class="container">
            <form class="form__wrapper" v-if="step === 'form'" @submit.prevent="onGenerate">
                <input type="text" placeholder="Введите номера магазина (например: 1001)" class="form__input"
                    @keyup.enter="onGenerate" v-model="storeIdInput">

                <input class="form__button" type="button" value="Сгенерировать QR" @click="onGenerate">
            </form>
            <div v-else class="qr__wrapper">
                <div class="qr_title-wrap">
                    <h2 class="qr__title">Сканируйте QR Код</h2>
                    <p class="qr__subtitle">Отсканируйте QR в боте для начала смены.</p>
                </div>
                <div class="qr_hero">
                    <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="qr__img" />
                    <p v-if="error" class="qr__err">{{ error }}</p>
                </div>
            </div>
        </div>

    </section>

</template>

<script>
import QRCode from 'qrcode'

export default {
  data() {
    return {
      step: 'form',
      storeIdInput: '',
      qrDataUrl: '',
      error: '',
      timer: null,
      _rsaPubKey: null,

      // константы
      APP_SECRET: 'qr-landing-app-secret-v1', // для шифрования storeId в localStorage
      QR_TTL_SECONDS: 10,                     // «срок годности» QR (сек)
    }
  },

  async mounted() {
    try {
      // 1) грузим PEM из /public (=> доступен как /scanner_public.pem)
      const pem = await fetch('/scanner_public.pem').then(r => {
        if (!r.ok) throw new Error('scanner_public.pem not found')
        return r.text()
      })
      // 2) импортируем ключ в WebCrypto
      this._rsaPubKey = await this.importRsaPublicKey(pem)

      // 3) восстановление storeId из зашифрованного localStorage
      const restored = await this.loadStoreIdEncrypted()
      if (restored) {
        this.storeIdInput = restored
        this.step = 'qr'
        await this.generateQrOnce()
        this.startTicker()
      }
    } catch (e) {
      this.error = e?.message || 'Не удалось загрузить публичный ключ'
    }
  },

  beforeUnmount() { this.stopTicker() },

  methods: {
    // ───────────────── base64url ─────────────────
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

    // ─────────── импорт публичного RSA (PEM → CryptoKey) ───────────
    async importRsaPublicKey(pem) {
      const text = pem.trim()
      if (!text.includes('-----BEGIN PUBLIC KEY-----') || !text.includes('-----END PUBLIC KEY-----')) {
        throw new Error('Invalid PEM: missing header/footer')
      }
      const lines = text.split(/\r?\n/)
      const body = lines.slice(1, -1).join('')
      // обычный base64 → ArrayBuffer
      const pad = body.length % 4 ? 4 - (body.length % 4) : 0
      const b64 = body + '='.repeat(pad)
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const der = bytes.buffer

      return crypto.subtle.importKey(
        'spki',
        der,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      )
    },

    // ─────────── шифрование storeId в localStorage (AES-GCM) ───────────
    async deriveLocalKey() {
      const enc = new TextEncoder()
      const baseKey = await crypto.subtle.importKey(
        'raw', enc.encode(this.APP_SECRET), { name: 'PBKDF2' }, false, ['deriveKey']
      )
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('qr-landing-salt'), iterations: 200000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    },

    async saveStoreIdEncrypted(storeId) {
      const key = await this.deriveLocalKey()
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const pt = new TextEncoder().encode(storeId)
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt)
      const payload = `${this.b64uEnc(iv)}.${this.b64uEnc(ct)}`
      localStorage.setItem('qr_store_id_enc', payload)
    },

    async loadStoreIdEncrypted() {
      const payload = localStorage.getItem('qr_store_id_enc')
      if (!payload) return null
      try {
        const [ivB64, ctB64] = payload.split('.')
        const key = await this.deriveLocalKey()
        const pt = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(this.b64uDec(ivB64)) },
          key,
          this.b64uDec(ctB64)
        )
        return new TextDecoder().decode(pt)
      } catch {
        return null
      }
    },

    // ─────────── JWE-подобное шифрование полезной нагрузки ───────────
    async jweEncrypt(publicKey, plaintextObj) {
      // 1) одноразовый AES-ключ (CEK) и IV
      const cek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      // 2) JSON → шифртекст
      const plaintext = new TextEncoder().encode(JSON.stringify(plaintextObj))
      const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cek, plaintext)
      // 3) CEK (raw) → шифруем RSA-OAEP публичным ключом сканера
      const cekRaw = await crypto.subtle.exportKey('raw', cek)
      const encKeyBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, cekRaw)
      // 4) компактная строка (header.encKey.iv.ciphertext.tag[пусто])
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

    // ─────────── Генерация QR один раз ───────────
    async generateQrOnce() {
      try {
        this.error = ''
        if (!this._rsaPubKey) return // ждём загрузки ключа

        const storeId = (this.storeIdInput || '').trim()
        if (!storeId) return

        const now = Math.floor(Date.now() / 1000)
        const payload = {
          v: 1,
          store_id: storeId,
          ts: now,
          exp: now + this.QR_TTL_SECONDS,
          nonce: this.b64uEnc(crypto.getRandomValues(new Uint8Array(12))),
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

    // ─────────── Тикер ───────────
    startTicker() {
      this.stopTicker()
      this.timer = setInterval(this.generateQrOnce, 1000)
    },
    stopTicker() {
      if (this.timer) { clearInterval(this.timer); this.timer = null }
    },

    // ─────────── UI ───────────
    async onGenerate() {
      if (!(this.storeIdInput || '').trim()) return
      await this.saveStoreIdEncrypted(this.storeIdInput.trim())
      this.step = 'qr'
      await this.generateQrOnce()
      this.startTicker()
    },
    resetAll() {
      this.stopTicker()
      this.qrDataUrl = ''
      this.step = 'form'
    },
  }
}
</script>


<style>
.form {
    display: flex;
    align-items: center;
    border-radius: 16px;
}

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
    transition: border-color 0.3s ease;
    box-sizing: border-box
}

.form__button {
    /* padding: 12px 24px; */
    font-family: "Montserrat", sans-serif;
    font-size: 24px;
    transition: background-color 0.3s ease;

    width: 268px;
    height: 80px;

    color: white;
    border: none;
    border-radius: 0 16px 16px 0;
    background-color: #316EED;
    padding: 0 16px;
}

.qr__wrapper {
    width: 520px;
    margin: 0 auto;
    background: rgba(255, 255, 255, .6);
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;

    padding: 48px 50px;
}

.qr__title {
    margin: 0 0 8px;
    font-weight: 600;
    font-family: "Montserrat", sans-serif;
    font-size: 32px;
}

.qr__subtitle {
    font-family: "Montserrat", sans-serif;
    margin: 0 0 16px;
    opacity: .7;
    font-size: 16px;
}

.qr__img {
    width: 320px;
    height: 320px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
}

.qr__err {
    color: #d92c20;
    margin-top: 10px;
    font-family: "Montserrat", sans-serif;
    margin: 0 0 16px;
    opacity: .7;
    font-size: 16px;
}

.qr__actions {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.qr__change {
    background: transparent;
    border: none;
    text-decoration: underline;
    cursor: pointer;
}

.qr__hint {
    font-size: 12px;
    opacity: .6;
}
</style>