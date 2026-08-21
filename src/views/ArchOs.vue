<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { detect, OS_NAME, ARCH_LABEL, type ArchOsResult } from '@/lib/archOs'

const router = useRouter()

type TabKey = 'linux' | 'windows' | 'macos'

const checking = ref(true)
const result = ref<ArchOsResult | null>(null)
const archLabel = ref('')
const activeTab = ref<TabKey>('linux')
const TAB_BY_OS: Record<string, TabKey> = {
  Windows: 'windows',
  macOS: 'macos',
  Linux: 'linux',
  Other: 'linux',
}

const BROWSERS = [
  'Google Chrome 谷歌浏览器',
  'Microsoft Edge 微软浏览器',
  'Firefox 火狐浏览器',
  'Opera 欧朋浏览器',
  'Brave 浏览器',
  '360 安全浏览器 / 360 极速浏览器',
  '搜狗浏览器',
  'QQ 浏览器',
  'UC 浏览器',
  '猎豹浏览器',
  '奇安信浏览器',
  '360 信创浏览器',
  '麒麟浏览器',
  '统信浏览器',
  '龙芯浏览器 / 星火浏览器',
  '红莲花浏览器',
]

function selectTab(key: TabKey): void {
  activeTab.value = key
}

onMounted(() => {
  detect(navigator).then((r) => {
    result.value = r
    activeTab.value = TAB_BY_OS[r.os] ?? 'linux'
    if (r.reliable && r.arch) {
      archLabel.value = ARCH_LABEL[r.arch] || String(r.arch).toUpperCase()
    }
    checking.value = false
  })
})

const OS_TIPS =
  '这里只会显示以下一种：\n– Windows：最常见的电脑系统\n– macOS：苹果电脑系统\n– Linux：开源系统，含统信、麒麟等国产系统\n– 其他系统：不在以上三类，通常是 ChromeOS、Android、iOS 等'
const ARCH_TIPS =
  '这里只会显示以下一种：\n– amd64（x64 / x86-64）：Intel 或 AMD 芯片，绝大多数电脑\n– arm64：ARM 芯片，多见于苹果 M 系列、骁龙、飞腾、麒麟等\n– x86（32 位）：较老的一种 32 位芯片\n– 识别失败：浏览器识别不出，需自己手动查看'
</script>

<template>
  <div class="space-y-6">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">操作系统与芯片架构</h2>
      <div class="ml-auto flex items-center gap-2">
        <a
          href="/tools/os-arch-detector.html"
          download="os-arch-detector.html"
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          下载离线版
        </a>
      </div>
    </div>

    <!-- 检测结果卡 -->
    <div class="mx-auto max-w-2xl">
      <div class="rounded-lg border bg-card">
        <div class="flex items-center border-b px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          🔎 自动识别
        </div>
        <table class="w-full">
          <tbody>
            <tr class="border-b last:border-0">
              <th class="w-1 whitespace-nowrap px-4 py-4 text-left align-middle text-sm font-medium text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  操作系统
                  <span
                    tabindex="0"
                    data-tip=""
                    :title="OS_TIPS"
                    class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-accent text-[11px] font-bold leading-none text-muted-foreground hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >?</span>
                </span>
              </th>
              <td class="px-4 py-4 text-lg font-semibold">
                {{ checking ? '正在检查…' : result ? OS_NAME[result.os] : '—' }}
              </td>
            </tr>
            <tr>
              <th class="w-1 whitespace-nowrap px-4 py-4 text-left align-middle text-sm font-medium text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  芯片架构
                  <span
                    tabindex="0"
                    :title="ARCH_TIPS"
                    class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-accent text-[11px] font-bold leading-none text-muted-foreground hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >?</span>
                </span>
              </th>
              <td class="px-4 py-4 text-lg font-semibold">
                {{ checking ? '正在检查…' : archLabel || '识别失败' }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 结果提示 -->
        <div v-if="!checking" class="px-4 pb-4">
          <div
            v-if="result && result.reliable && result.arch"
            class="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <span class="font-bold">✓</span> 已自动识别出你的电脑信息，结果如上。
          </div>
          <div
            v-else-if="result"
            class="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
          >
            <span class="font-bold">⚠️</span>
            <template v-if="result.chromium">自动识别失败，请按下方「自己动手查」的步骤核对你的系统。</template>
            <template v-else>
              自动识别失败，请更换浏览器后再打开本页尝试。
            </template>
          </div>

          <!-- 换浏览器建议 -->
          <div v-if="result && !result.reliable && !result.chromium" class="mt-4 border-t border-dashed pt-4">
            <div class="mb-2 text-sm font-semibold">建议换用的浏览器：</div>
            <ul class="grid gap-1 pl-4 text-sm leading-7 marker:text-muted-foreground list-disc">
              <li v-for="b in BROWSERS" :key="b">{{ b }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 自查指引 -->
    <div class="mx-auto max-w-2xl rounded-lg border bg-card">
      <div class="px-4 pt-4">
        <h2 class="text-base font-semibold">自己动手查一下，通常更准</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">照着下面你自己的系统来做，一分钟就能找到。</p>
      </div>

      <div class="flex gap-1 border-b px-4 pt-3" role="tablist">
        <button
          v-for="t in ([
            { key: 'linux', label: 'Linux / 国产系统' },
            { key: 'windows', label: 'Windows' },
            { key: 'macos', label: 'macOS（苹果）' },
          ] as Array<{ key: TabKey; label: string }>)"
          :key="t.key"
          role="tab"
          :aria-selected="activeTab === t.key ? 'true' : 'false'"
          class="-mb-px rounded-t-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="activeTab === t.key ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="selectTab(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Linux -->
      <ol v-if="activeTab === 'linux'" class="space-y-4 px-4 py-4 text-sm leading-relaxed list-decimal marker:font-semibold marker:text-muted-foreground">
        <li>
          打开「<b>终端</b>」，任选一种方式就行：
          <ul class="mt-1 list-disc pl-5 marker:text-muted-foreground">
            <li>方式一（最快）：同时按下键盘上的 <b>Ctrl + Alt + T</b> 三个键。</li>
            <li>方式二：在桌面空白处点<b>右键</b>，在菜单里选「<b>在终端中打开</b>」。</li>
            <li>方式三：打开系统的<b>应用菜单</b>（所有程序的列表），在搜索框搜“<b>终端</b>”或“<b>Terminal</b>”再点开。</li>
            <li class="text-muted-foreground">终端就是那个<b class="text-foreground">黑色小窗口</b>样的程序。</li>
          </ul>
        </li>
        <li>
          在窗口里输入 <code class="rounded bg-accent px-1.5 py-0.5 font-mono text-[13px]">uname -m</code>，然后按<b>回车</b>。
          <div class="mt-0.5 text-xs text-muted-foreground">注意：uname 和 -m 之间要留一个空格，输入完一定要按回车键。</div>
        </li>
        <li>
          看输出的一行字母：
          <ul class="mt-1 list-disc pl-5 marker:text-muted-foreground">
            <li>显示 <b>x86_64</b>：芯片架构是 <b>amd64</b>。</li>
            <li>显示 <b>aarch64</b>：芯片架构是 <b>arm64</b>。</li>
          </ul>
        </li>
      </ol>

      <!-- Windows -->
      <ol v-else-if="activeTab === 'windows'" class="space-y-4 px-4 py-4 text-sm leading-relaxed list-decimal marker:font-semibold marker:text-muted-foreground">
        <li>
          进入能看到「系统类型」的页面：
          <ul class="mt-1 list-disc pl-5 marker:text-muted-foreground">
            <li><b>Windows 11</b>：点屏幕正中下方的「开始」按钮，再点「<b>设置</b>」，然后「<b>系统</b>」-「<b>关于</b>」。</li>
            <li><b>Windows 10</b>：点屏幕左下角的「开始」按钮，再点「<b>设置</b>」，然后「<b>系统</b>」-「<b>关于</b>」。</li>
            <li><b>Windows 8</b>：把鼠标移到屏幕最右边滑出侧边栏，点「设置」，然后「<b>电脑和设备</b>」-「<b>电脑信息</b>」。</li>
            <li><b>Windows 7 / XP</b>：在桌面上<b>右键点「我的电脑」或「计算机」，选「属性」</b>。</li>
          </ul>
        </li>
        <li>
          找到写着「<b>系统类型</b>」的一行，看写的是什么：
          <ul class="mt-1 list-disc pl-5 marker:text-muted-foreground">
            <li>写的是「<b>x64</b> 处理器」：芯片架构是 <b>amd64</b>。</li>
            <li>写的是「<b>ARM64</b>」：芯片架构是 <b>arm64</b>。</li>
            <li>写的是「<b>x86</b>」或什么都没标：芯片架构是 <b>x86（32 位）</b>。</li>
          </ul>
        </li>
      </ol>

      <!-- macOS -->
      <ol v-else class="space-y-4 px-4 py-4 text-sm leading-relaxed list-decimal marker:font-semibold marker:text-muted-foreground">
        <li>点屏幕最左上角的<b>苹果标志</b>。</li>
        <li>点「<b>本机</b>」（也叫“关于本机”）。</li>
        <li>
          看「芯片」或「处理器」那一行：
          <ul class="mt-1 list-disc pl-5 marker:text-muted-foreground">
            <li>如果写的是「<b>Apple M1 / M2 / M3 / M4</b>」这样的：芯片架构是 <b>arm64</b>。</li>
            <li>如果写的是「<b>Intel</b>」：芯片架构是 <b>amd64</b>。</li>
          </ul>
        </li>
      </ol>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>{{ checking ? '正在识别…' : result && result.reliable && result.arch ? '已自动识别' : '未能自动识别，请按上方指引自查' }}</span>
      <span>纯前端识别 · 无需联网</span>
    </div>
  </div>
</template>