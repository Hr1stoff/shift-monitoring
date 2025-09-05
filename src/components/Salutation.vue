<template>
    <section class="salutation">
        <div class="container">
            <div class="salutation__wrapper">
                <p class="salutation__title">Добро пожаловать!</p>
                <p class="salutation__subtitle">В контроль смены.</p>
            </div>
        </div>
    </section>

</template>

<script>
export default {

}
</script>

<style>
.salutation {}

.salutation__wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}

.salutation__title {
    font-family: "Montserrat", sans-serif;
    font-size: 64px;
}

.salutation__subtitle {
    font-family: "Montserrat", sans-serif;
    font-size: 32px;
}
</style>