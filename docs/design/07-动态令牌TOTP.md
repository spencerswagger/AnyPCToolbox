# 产品方案：动态令牌（TOTP，Google 兼容 + indexedDB）

> 状态：设计稿（未实现） · 日期：2026-08-22 · 模式：纯前端本地（Tauri 优先）

## 一、定位

兼容 Google Authenticator 的一次性验证码（TOTP，RFC 6238）的桌面令牌管理器。多账号管理、30 秒滚动验证码、一键复制，账号种子 **indexedDB** 本地持久化，彻底离线。可与 #06 密码生成器共用同一套加密存储层。

## 二、目标用户

- 需要在桌面上查看二次验证码、替代手机上打开 Google Authenticator 的用户。
- 同时管理 GitHub / 微软 / 各种平台 2FA 账号的重度用户。

## 三、页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回 | 动态令牌                      [添加账号][搜索]        │
├─────────────────────────────────────────────────────────────┤
│  账号卡片（网格/流式）                                         │
│  ┌─────────────────────┐                                     │
│  │  GitHub · alice      │  6 位码：123 456                    │
│  │  ●●●●●●●●●○○○ 30s    │  [复制]                             │
│  └─────────────────────┘                                     │
├─────────────────────────────────────────────────────────────┤
│  (折叠) 添加账号表单 + 导出备份                                │
└─────────────────────────────────────────────────────────────┘
```

- 卡片式：品牌（服务名）/账号 + 6 位滚动验证码 + **30 秒倒计时进度环** + `复制`按钮。
- 顶部搜索过滤账号；`添加账号`、`导出备份`（导出含种子的加密备份 `.json`）。

## 四、交互流程

1. `添加账号`：二选一 —— 手动输入 Base32 密钥 / 粘贴 `otpauth://` URI 自动解析（含 issuer、account、secret、digits、period）。
2. 添加后卡片实时显示 6 位验证码与倒计时。
3. `复制`即把当前 6 位码放入剪贴板；倒计时归零后自动刷新下一轮。
4. 账号可删除、重排、改名；支持分组（按服务类型）。
5. 导出加密备份用于迁移。

## 五、功能详述与算法

- **TOTP（RFC 6238）**：`TOTP = HOTP(K, floor((T-T0)/X))`；`HOTP = Truncate(HMAC-SHA1(K, C))`；时间步长 `X=30`，`T0=0`，默认 6 位，`counter` 即秒级时间戳/步进。支持 digits 6/8、步长 30/60 可被 URI 的 `digits`/`period` 参数覆盖。
- **Base32 解码**：RFC 4648 无填充（A–Z2–7），自动去掉空格与小写归一。
- **otpauth URI**：`otpauth://totp/Issuer:account?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30` 解析为账号模型。
- **倒计时环**：SVG 环形进度，随剩余秒更新；归零瞬间用最新 counter 重算验证码。
- **加密存储（与 #06 共用）**：种子与账号信息用主口令 + AES-GCM 加密后落 indexedDB；用户已启用加密时新增/读取都需主口令解密；未启用加密 + 明示风险。种子是本工具敏感核心，**默认强烈建议启用加密**。

## 六、数据与状态

- 数据库：`indexedDB`，库名 `anypctoolbox`，表 `totpAccounts`：`{ id, issuer, account, secret, digits, period, algorithm, group, createdAt }`。
- 时长/显示偏好存 localStorage（key: `totp:prefs`）。
- 种子绝不写 localStorage 明文（若非加密模式，仍保证只在 indexedDB）。

## 七、技术要点与模块划分

```
src/lib/totp/
  base32.ts     # Base32 解码（RFC 4648 无填充、去空格）
  totp.ts       # HMAC-SHA1 + Truncate（RFC 6238 核心）
  uri.ts        # otpauth:// 解析 / 生成
  store.ts      # indexedDB 封装（增删改查）
  encrypt.ts    # 复用 #06 的 AES-GCM + PBKDF2 加密存储层
src/views/Totp.vue
src/components/totp/TotpCard.vue / ProgressRing.vue
```

- 时间获取：Tauri 读系统时间 `Date`，无浏览器的同源 TLS 时间限制问题；Web 态若时间偏差可用，仍以本地系统时间为准（明示依赖系统时钟）。
- 复用 #06 的 `encrypt.ts` / `store.ts`：抽取为共享的 `src/lib/crypto-store/`。

## 八、边界情况

- 密钥非 Base32 / 非法长度：添加时即时校验提示。
- URI 解析失败：提示"URI 无效"，不落库。
- 系统时间偏差过大：验证码普遍不对时，提示"请校准系统时间"。
- 主口令错误解密：提示不清数据。
- 大量账号：卡片流式 + 虚拟滚动，确保流畅。

## 九、不做的事

- 不做 HOTP（计数器型）首版（聚焦 TOTP；HOTP 可后置）。
- 不做 SSH 密钥 / FIDO / WebAuthn。
- 不做端到端云端同步（纯本地）。
- 不做自动填写浏览器表单（仅复制）。