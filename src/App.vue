<template>
    <Salutation />
    <InitialSetup />
    <section class="footer">
        <p class="footer__title">IT Лаборатория. 2025</p>
    </section>
</template>

<script>
import Salutation from '@/components/Salutation.vue';
import InitialSetup from '@/components/InitialSetup.vue';
export default {
    components: {
        Salutation, InitialSetup
    }
}
</script>

<style>
.footer {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.footer__title {
    width: 190px;
    margin-top: auto;
    padding: 30px 20px;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.5);
    font-family: "Source Sans 3", sans-serif;
    cursor: default;
}
</style>
