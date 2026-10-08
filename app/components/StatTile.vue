<script setup lang="ts">
	defineProps<{ value: string | number; label: string }>();
</script>

<template>
	<div class="rounded-[10px] border border-line bg-surface-2 px-4 py-3">
		<div class="text-[1.6rem] font-bold tabular-nums">{{ value }}</div>
		<div class="text-xs text-muted">{{ label }}</div>
	</div>
</template>
