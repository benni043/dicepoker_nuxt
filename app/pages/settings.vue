<script setup lang="ts">
	const { locale, locales, setLocale, t } = useI18n();
	const { user, fetch: refreshSession, clear } = useUserSession();
	const localePath = useLocalePath();

	const name = ref(user.value?.name ?? "");
	const saving = ref(false);
	const message = ref("");
	const error = ref("");

	async function saveName() {
		saving.value = true;
		message.value = error.value = "";
		try {
			await $fetch("/api/me", { method: "PATCH", body: { name: name.value } });
			await refreshSession();
			message.value = t("settings.saved");
		} catch {
			error.value = t("errors.INTERNAL");
		} finally {
			saving.value = false;
		}
	}

	async function logout() {
		disconnectGame();
		await clear();
		await navigateTo(localePath("login"));
	}
</script>

<template>
	<div class="settings">
		<h1>{{ $t("settings.title") }}</h1>

		<section class="card">
			<h2>{{ $t("settings.profile") }}</h2>
			<form class="row" @submit.prevent="saveName">
				<label class="field grow">
					<span>{{ $t("settings.displayName") }}</span>
					<input v-model="name" class="input" maxlength="20" required>
				</label>
				<button
					type="submit"
					class="btn btn-primary"
					:disabled="saving || !name.trim() || name === user?.name"
				>
					{{ $t("settings.save") }}
				</button>
			</form>
			<p v-if="message" class="ok small">{{ message }}</p>
			<p v-if="error" class="error small">{{ error }}</p>
		</section>

		<section class="card">
			<h2>{{ $t("settings.language") }}</h2>
			<div class="langs">
				<button
					type="button"
					v-for="l in locales"
					:key="l.code"
					class="btn"
					:class="{ 'btn-primary': l.code === locale }"
					@click="setLocale(l.code)"
				>
					{{ l.name }}
				</button>
			</div>
		</section>

		<section class="card">
			<h2>{{ $t("settings.account") }}</h2>
			<div class="account">
				<img
					v-if="user?.avatarUrl"
					:src="user.avatarUrl"
					alt=""
					class="avatar"
					referrerpolicy="no-referrer"
				>
				<p class="muted">
					{{ $t("settings.loggedInAs", { name: user?.name }) }}
				</p>
				<button type="button" class="btn btn-ghost" @click="logout">
					{{ $t("settings.logout") }}
				</button>
			</div>
		</section>
	</div>
</template>

<style scoped>
	.settings {
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.row .field {
		margin-bottom: 0;
	}
	.grow {
		flex: 1;
	}
	.ok {
		color: var(--accent);
	}
	.langs {
		display: flex;
		gap: 0.5rem;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.account p {
		margin: 0;
		flex: 1;
	}
	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}
</style>
