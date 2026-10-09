<script setup lang="ts">
	const localePath = useLocalePath();
</script>

<template>
	<div class="card mx-auto my-12 max-w-[26.25rem] text-center">
		<div class="mb-2 text-[3.5rem] leading-none font-extrabold text-accent">
			404
		</div>
		<h1>{{ $t("notFound.title") }}</h1>
		<p class="mb-4 text-muted">{{ $t("notFound.text") }}</p>
		<NuxtLink :to="localePath('index')" class="btn btn-primary">
			{{ $t("common.toHome") }}
		</NuxtLink>
	</div>
</template>
