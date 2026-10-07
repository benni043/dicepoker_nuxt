<script setup lang="ts">
	const localePath = useLocalePath();
	const { read } = useLocalizedQuery();
	const isDev = import.meta.dev;
	const devName = ref("");

	const redirect = computed(() => read("redirect") ?? localePath("index"));
	const failed = computed(() => !!read("error"));
	const googleUrl = computed(
		() =>
			`/api/auth/callback/google?redirect=${encodeURIComponent(redirect.value)}`,
	);

	function devLogin() {
		window.location.href = `/auth/dev?name=${encodeURIComponent(devName.value)}&redirect=${encodeURIComponent(redirect.value)}`;
	}
</script>

<template>
	<div class="login">
		<div class="card narrow">
			<div class="logo">⚄</div>
			<h1>{{ $t("login.title") }}</h1>
			<p class="muted">{{ $t("login.subtitle") }}</p>
			<p v-if="failed" class="error">{{ $t("login.failed") }}</p>

			<a :href="googleUrl" class="btn btn-google btn-block btn-lg">
				<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
					<path
						fill="#FFC107"
						d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
					/>
					<path
						fill="#FF3D00"
						d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
					/>
					<path
						fill="#4CAF50"
						d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
					/>
					<path
						fill="#1976D2"
						d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
					/>
				</svg>
				{{ $t("login.google") }}
			</a>

			<form v-if="isDev" class="dev" @submit.prevent="devLogin">
				<p class="muted small">{{ $t("login.devHint") }}</p>
				<div class="dev-row">
					<input
						v-model="devName"
						class="input"
						maxlength="20"
						required
						:placeholder="$t('login.devName')"
					>
					<button type="submit" class="btn" :disabled="!devName.trim()">
						{{ $t("login.devLogin") }}
					</button>
				</div>
			</form>
		</div>
	</div>
</template>

<style scoped>
	.login {
		text-align: center;
	}
	.logo {
		font-size: 3rem;
		line-height: 1;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}
	.btn-google {
		margin-top: 1rem;
		background: #fff;
		color: #1f1f1f;
		border-color: #fff;
	}
	.btn.btn-google:hover:not(:disabled) {
		background: #e8eaed;
	}
	.dev {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border);
	}
	.dev-row {
		display: flex;
		gap: 0.5rem;
	}
	.dev-row .btn {
		white-space: nowrap;
	}
</style>
