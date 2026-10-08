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
	<div class="mx-auto flex max-w-160 flex-col gap-5">
		<h1>{{ $t("settings.title") }}</h1>

		<section class="card">
			<h2>{{ $t("settings.profile") }}</h2>
			<form class="flex items-end gap-3" @submit.prevent="saveName">
				<label class="field mb-0 flex-1">
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
			<p v-if="message" class="mt-2 text-sm text-accent">{{ message }}</p>
			<p v-if="error" class="mt-2 text-sm text-danger">{{ error }}</p>
		</section>

		<section class="card">
			<h2>{{ $t("settings.language") }}</h2>
			<div class="flex gap-2">
				<button
					v-for="l in locales"
					:key="l.code"
					type="button"
					class="btn"
					:class="{ 'btn-primary': l.code === locale }"
					@click="setLocale(l.code)"
				>
					{{ l.name }}
				</button>
			</div>
		</section>

		<DesignsSettings />

		<section class="card">
			<h2>{{ $t("settings.account") }}</h2>
			<div class="flex items-center gap-3">
				<img
					v-if="user?.avatarUrl"
					:src="user.avatarUrl"
					alt=""
					class="size-10 rounded-full"
					referrerpolicy="no-referrer"
				>
				<p class="flex-1 text-muted">
					{{ $t("settings.loggedInAs", { name: user?.name }) }}
				</p>
				<button type="button" class="btn btn-ghost" @click="logout">
					{{ $t("settings.logout") }}
				</button>
			</div>
		</section>
	</div>
</template>
