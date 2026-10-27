<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { CircleHelp } from 'lucide-vue-next';

defineProps<{ id: string; label: string }>();
const trigger = ref<HTMLButtonElement>(), tooltip = ref<HTMLElement>();
const visible = ref(false), position = ref({ left: '0px', top: '0px' });
let closeTimer: ReturnType<typeof setTimeout> | undefined;
function cancelClose() { clearTimeout(closeTimer); }
function hide() { cancelClose(); visible.value = false; }
async function show() {
  cancelClose(); visible.value = true;
  await nextTick();
  if (!trigger.value || !tooltip.value) return;
  const anchor = trigger.value.getBoundingClientRect(), panel = tooltip.value.getBoundingClientRect();
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - panel.width - 12));
  const below = anchor.bottom + 8;
  const top = below + panel.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - panel.height - 8);
  position.value = { left: `${left}px`, top: `${top}px` };
}
function deferClose() {
  cancelClose();
  closeTimer = setTimeout(() => { if (document.activeElement !== trigger.value) hide(); }, 150);
}
function viewportChanged(event: Event) {
  if (!visible.value || (event.target instanceof Node && tooltip.value?.contains(event.target))) return;
  if (document.activeElement === trigger.value) void show();
  else hide();
}
onMounted(() => {
  window.addEventListener('resize', viewportChanged);
  window.addEventListener('scroll', viewportChanged, true);
});
onUnmounted(() => {
  cancelClose();
  window.removeEventListener('resize', viewportChanged);
  window.removeEventListener('scroll', viewportChanged, true);
});
</script>

<template>
  <button ref="trigger" type="button" class="field-help-button" :aria-label="label+'说明'" :aria-describedby="id" @mouseenter="show" @mouseleave="deferClose" @focus="show" @blur="hide" @click="show" @keydown.esc.stop="hide"><CircleHelp :size="15" aria-hidden="true"/></button>
  <Teleport to="body"><div v-show="visible" :id="id" ref="tooltip" role="tooltip" class="field-help-tooltip" :style="position" @mouseenter="cancelClose" @mouseleave="deferClose"><slot/></div></Teleport>
</template>

<style scoped>
.field-help-button{padding:3px;border-radius:50%;color:var(--muted);flex-shrink:0}.field-help-button:hover,.field-help-button:focus-visible{color:var(--green);background:var(--soft)}.field-help-tooltip{position:fixed;z-index:30;width:max-content;max-width:min(300px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;border-radius:8px;background:#263d30;color:#fff;font-size:14px;line-height:1.8;box-shadow:0 6px 24px #14271c30;overflow-wrap:anywhere}@media(forced-colors:active){.field-help-tooltip{background:Canvas;color:CanvasText;border:1px solid CanvasText}}
</style>
