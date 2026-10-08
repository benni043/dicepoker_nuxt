export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.directive<HTMLElement, boolean | undefined>("focus", {
		mounted(el, binding) {
			if (binding.value !== false) el.focus();
		},
	});
});
