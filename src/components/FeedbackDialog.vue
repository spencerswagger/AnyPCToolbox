<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import { useToaster } from '@/lib/ui/use-toast'
import { FEEDBACK_WEBHOOK_URL, FEEDBACK_WEBHOOK_TOKEN } from '@/lib/feedback/config'
import {
  FEEDBACK_TYPES,
  CONTENT_MAX_LENGTH,
  CONTACT_MAX_LENGTH,
  buildFeedbackPayload,
  validateFeedback,
  submitFeedback,
  type FeedbackType,
} from '@/lib/feedback/feedback'

const open = defineModel<boolean>('open', { required: true })

const { toast } = useToaster()

const type = ref<FeedbackType>('bug')
const content = ref('')
const contact = ref('')
const consent = ref(true)
const submitting = ref(false)
const cooldownUntil = ref(0)

const COOLDOWN_MS = 30_000

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  const now = Date.now()
  if (now < cooldownUntil.value) {
    toast('提交过于频繁', '请 30 秒后再试')
    return
  }
  const payload = buildFeedbackPayload({
    type: type.value,
    content: content.value,
    contact: contact.value,
    consent: consent.value,
  })
  const err = validateFeedback(payload)
  if (err) {
    toast('无法提交', err)
    return
  }
  if (!FEEDBACK_WEBHOOK_URL) {
    toast('反馈通道未配置', '请联系管理员配置后使用')
    return
  }
  submitting.value = true
  const result = await submitFeedback({
    url: FEEDBACK_WEBHOOK_URL,
    token: FEEDBACK_WEBHOOK_TOKEN || undefined,
    payload,
  })
  submitting.value = false
  cooldownUntil.value = Date.now() + COOLDOWN_MS
  if (result.ok) {
    toast('感谢反馈', '您的意见已提交，我们会尽快处理')
    open.value = false
    reset()
  } else {
    toast('提交失败', result.error ?? '请稍后重试')
  }
}

function reset(): void {
  type.value = 'bug'
  content.value = ''
  contact.value = ''
  consent.value = true
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[100] bg-black/50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-[110] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-base font-semibold">意见反馈</DialogTitle>
            <DialogDescription class="mt-1 text-sm text-muted-foreground">
              告诉我们您遇到的问题或建议，帮助我们做得更好。
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="关闭"
            class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X class="h-4 w-4" />
          </DialogClose>
        </div>

        <form class="mt-4 grid gap-4" @submit.prevent="handleSubmit">
          <div class="grid gap-2">
            <label class="text-sm font-medium">类型</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in FEEDBACK_TYPES"
                :key="t.value"
                type="button"
                class="rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="
                  type === t.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input hover:bg-accent hover:text-accent-foreground'
                "
                :aria-pressed="type === t.value"
                @click="type = t.value"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <div class="grid gap-2">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium" for="feedback-content">内容 <span class="text-destructive">*</span></label>
              <span class="text-xs text-muted-foreground">{{ content.length }}/{{ CONTENT_MAX_LENGTH }}</span>
            </div>
            <textarea
              v-model="content"
              id="feedback-content"
              :maxlength="CONTENT_MAX_LENGTH"
              rows="5"
              required
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="请描述您遇到的问题或建议……"
            />
          </div>

          <div class="grid gap-2">
            <label class="text-sm font-medium" for="feedback-contact">联系方式（选填）</label>
            <input
              v-model="contact"
              id="feedback-contact"
              :maxlength="CONTACT_MAX_LENGTH"
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="邮箱 / 微信 / 手机号"
            />
            <p class="text-xs text-muted-foreground">填写后我们可能联系您跟进反馈。</p>
          </div>

          <label class="flex items-start gap-2 text-sm text-muted-foreground" for="feedback-consent">
            <input v-model="consent" type="checkbox" id="feedback-consent" class="mt-0.5 h-4 w-4" />
            <span>同意我们使用以上联系方式回复您的反馈，仅用于此目的。</span>
          </label>

          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {{ submitting ? '提交中…' : '提交反馈' }}
          </button>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
