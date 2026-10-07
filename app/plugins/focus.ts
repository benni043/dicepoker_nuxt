// v-focus: focuses the element once it is mounted (v-focus="false" to skip).
export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.directive<HTMLElement, boolean | undefined>("focus", {
		mounted(el, binding) {
			if (binding.value !== false) el.focus();
		},
	});
});
