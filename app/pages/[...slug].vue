<script setup lang="ts">
	const localePath = useLocalePath();
</script>

<template>
	<div class="card narrow not-found">
		<div class="code">404</div>
		<h1>{{ $t("notFound.title") }}</h1>
		<p class="muted">{{ $t("notFound.text") }}</p>
		<NuxtLink :to="localePath('index')" class="btn btn-primary">{{
			$t("common.toHome")
		}}</NuxtLink>
	</div>
</template>

<style scoped>
	.not-found {
		text-align: center;
	}
	.code {
		font-size: 3.5rem;
		font-weight: 800;
		color: var(--accent);
		line-height: 1;
		margin-bottom: 0.5rem;
	}
</style>
