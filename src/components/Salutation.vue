<template>
  <section class="salutation">
    <div class="container">
      <div class="salutation__wrapper">
        <p class="salutation__title reveal-down">Добро пожаловать!</p>
        <p class="salutation__subtitle reveal-down delay">В контроль смены.</p>
      </div>
    </div>
  </section>
</template>

<script>
export default {}
</script>

<style>

html, body { margin: 0; overflow-x: clip; }
@supports not (overflow: clip) {
  html, body { overflow-x: hidden; }
}

.salutation { overflow-x: clip; }

.salutation__wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}


.salutation__title {
  font-family: "Montserrat", sans-serif;
  font-size: 64px;
  line-height: 1.1;
}
.salutation__subtitle {
  font-family: "Montserrat", sans-serif;
  font-size: 32px;
}

.reveal-down {
  display: inline-block;
  clip-path: inset(0 0 100% 0);

  opacity: 0;
  transform: translateY(-6px);
  animation:
    wipe-down .9s cubic-bezier(.22,1,.36,1) forwards,
    fade-slide .6s cubic-bezier(.22,1,.36,1) forwards;
}


.reveal-down.delay {
  animation-delay: .15s, .15s; 
}

@keyframes wipe-down {
  to { clip-path: inset(0 0 0 0); }
}
@keyframes fade-slide {
  to { opacity: 1; transform: none; }
}


@media (max-width: 480px) {
  .salutation__title { font-size: 42px; }
  .salutation__subtitle { font-size: 22px; }
}


@media (prefers-reduced-motion: reduce) {
  .reveal-down {
    animation: none !important;
    opacity: 1;
    transform: none;
    clip-path: inset(0 0 0 0);
  }
}
</style>
