<script setup lang="ts">
	import { TURN_TIMEOUTS } from "#shared/game";

	defineProps<{ seconds: number; isHost: boolean }>();
	const emit = defineEmits<{ change: [seconds: number] }>();
</script>

<template>
	<div
		class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm"
	>
		<span class="text-lg leading-none">⏱</span>
		<span class="text-muted">{{ $t("fields.turnTimeout") }}:</span>
		<strong>
			{{
				seconds
					? $t("timeoutOption.seconds", { n: seconds })
					: $t("timeoutOption.off")
			}}
		</strong>
		<select
			v-if="isHost"
			class="input ml-auto w-auto px-2 py-1 text-sm"
			:value="seconds"
			:aria-label="$t('fields.turnTimeout')"
			@change="emit('change', Number(($event.target as HTMLSelectElement).value))"
		>
			<option v-for="n in TURN_TIMEOUTS" :key="n" :value="n">
				{{ n ? $t("timeoutOption.seconds", { n }) : $t("timeoutOption.off") }}
			</option>
		</select>
	</div>
</template>
