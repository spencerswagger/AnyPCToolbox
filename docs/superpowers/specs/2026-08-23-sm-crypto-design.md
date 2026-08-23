# 文本处理中台 · 国密大类（SM2/SM3/SM4）设计

日期：2026-08-23
状态：已确认
归属：`/text-hub` 文本处理中台
算法库：`sm-crypto`（纯 JS，无原生依赖，满足"纯前端路线"）

## 背景与目标

在「文本处理中台」（[TextHub.vue](/workspace/src/views/TextHub.vue)）中新增一个独立的**国密**大类，覆盖国密常用算法：SM3 哈希、SM4 对称加解密、SM2 非对称加解密、SM2 数字签名/验签。

用户明确要求：
- 单独新增「国密」大类（不并入现有加解密大类）。
- SM2 拆成「SM2 加密」「SM2 签名」两个子 tab。
- 路线选**纯前端 JS（sm-crypto）**。

### 关于 GmSSL-Nodejs

GmSSL-Nodejs 是 Node.js 原生 C 插件（N-API addon），运行于 Node 运行时。本项目是 **Tauri + WebView 前端（Vite/Vue）**，前端为浏览器环境无法直接调用 Node 原生模块，Tauri 后端又是 Rust 而非 Node，因此 GmSSL-Nodejs 在现有架构下**不可用**。故采用纯 JS 的 `sm-crypto`，行为与国密标准一致（SM4 ECB/CBC、SM2 C1C3C2、SM3 摘要）。

## 页面布局（遵循 docs/superpowers/specs/2026-08-18-tool-dev-convention.md）

复用 TextHub 现有「左输入 + 右大类 Tab + 子项面板」框架，不改整体布局，仅在右侧大类垂直栏新增一档：

```
右侧大类： [编解码] [哈希摘要] [加解密] [国密] [分析]
                ↓ 点击「国密」后，顶部子项 tab 展开：
                        [SM2 加密] [SM2 签名] [SM3] [SM4]
```

- 子项 tab 沿用现有 `itemsInCategory.length > 1` 时的横向 tab 渲染逻辑，无需改动 TextHub 模板。
- 空输入 / 全空格时进空态占位（现有逻辑自动生效）。

## 架构与数据流

延续现有「注册表驱动 + 纯函数 lib + 面板组件」模式，与 [aes.ts](/workspace/src/lib/text/aes.ts) / [HashPanel.vue](/workspace/src/components/text/HashPanel.vue) / [AesPanel.vue](/workspace/src/components/text/AesPanel.vue) 对齐。

```
TextHub.vue（input 状态）
  └─ 当前激活子项组件 component
       └─ props: { input, ...props }   （props 里带 algo/具体算法 id）
            └─ 调用 sm.ts 纯函数 → 返回 { ok, value | error }
```

- 文本由 TextHub 顶层持有，通过 `props.input` 传给面板（与现有面板一致，面板不持有输入本身）。
- 算法层全部为**纯函数**，失败返回 `{ ok:false, error }` 而非抛错，UI 标红。

### 算法注册表（`src/lib/text/registry.ts`）

- `Category` 联合类型增加 `'sm'`。
- `CATEGORIES` 数组在「加解密（aes）」之后插入 `{ id: 'sm', label: '国密' }`。
- 新增 4 个子项（均 `defineAsyncComponent` 懒加载，与现有 EncodePanel/AesPanel/HashPanel 一致）：

| id | label | component |
|----|-------|-----------|
| `sm2-enc` | SM2 加密 | Sm2EncPanel |
| `sm2-sign` | SM2 签名 | Sm2SignPanel |
| `sm3` | SM3 | Sm3Panel |
| `sm4` | SM4 | Sm4Panel |

## 组件清单（新增，均在 `src/components/text/`）

依赖方向上先确认 sm-crypto API，实现期以包内实际导出为准：

### SM3 哈希 —— `Sm3Panel.vue`
- 复用 [HashPanel.vue](/workspace/src/components/text/HashPanel.vue) 的单行摘要模式。
- 调用 `sm3(input: string) → hex 摘要`（注意 sm-crypto 默认对 utf8 字符串直接计算；如需与 SM2 数字签名入参区分，面板按字符串处理）。
- 提供「Hex 大写」开关 + 复制按钮。

### SM4 加解密 —— `Sm4Panel.vue`
- 复用 [AesPanel.vue](/workspace/src/components/text/AesPanel.vue) 的双栏（加密/解密）布局。
- 参数区：密钥输入（Hex/UTF8，16 字节）+ 随机生成密钥；模式 ECB/CBC；输出格式 Hex/Base64。
- 调用 sm-crypto `sm4.encrypt / sm4.decrypt`，CBC 时使用 IV（固定 Hex 或随机，默认全零可配）。

### SM2 加密/解密 —— `Sm2EncPanel.vue`
- 公钥/私钥输入（sm-crypto 为 hex） + 「生成密钥对」（`sm2.generateKeyPairHex()`）。
- 加密 `sm2.doEncrypt(plain, publicKey, cipherMode=1 /* C1C3C2 */)` → hex 密文。
- 解密 `sm2.doDecrypt(cipherHex, privateKey, cipherMode=1)` → 明文。
- 共享密钥对 store（见下）。

### SM2 签名/验签 —— `Sm2SignPanel.vue`
- 公钥/私钥输入 + 「生成密钥对」（复用同一 store）。
- 签名 `sm2.doSignature(msg, privateKey, opts)` → hex 签名。
- 验签 `sm2.doVerifySignature(msg, sigHex, publicKey, opts)` → 布尔。
- 支持可选消息摘要选项（默认使用标准处理，具体以 sm-crypto 导出的默认行为为准，签名/验签两侧保持一致）。

### SM2 密钥共享 store

SM2 加密与 SM2 签名拆成两个 tab、面板各自独立挂载，为避免在两处重复生成密钥，在 `sm.ts` 内放一个**模块级响应式 store**：任一 SM2 面板「生成密钥对」后，另一面板读同一公钥/私钥。tab 切换组件 `:is` 重挂时 store 数据仍在（内存态，刷新即失，符合项目"输入不持久化"约定）。

## 算法封装 `src/lib/text/sm.ts`

统一返回 `{ ok:true; value:string } | { ok:false; error:string }`，风格对齐 aes.ts/rsa.ts：

- `sm3Hash(text): SmResult`
- `sm4Encrypt(text, key, opts) / sm4Decrypt(cipher, key, opts)`，opts = `{ mode:'ECB'|'CBC', ivHex?, output:'hex'|'base64' }`
- `sm2GenerateKeyPair(): { publicKey, privateKey }`
- `sm2Encrypt(text, publicKey, cipherMode?) / sm2Decrypt(cipherText, privateKey, cipherMode?)`
- `sm2Sign(msg, privateKey, opts?) / sm2Verify(msg, signature, publicKey, opts?): boolean`
- keypair 共享 store（`reactive` 导出）

错误约定：非法 hex、密钥长度不等于 16 字节、缺少密钥/密钥不匹配等在封装层给出明确中文错误并返回 `ok:false`，不抛异常。

## 依赖

- `package.json` 新增 `sm-crypto`（纯 JS 依赖，浏览器可用，无 Node 原生依赖）。
- 前端无需 Tauri 改动、无需 Rust 侧代码。

## 验证

沿用项目惯例在 `scripts/verify-sm.ts` 中覆盖（跑 `tsx scripts/verify-sm.ts`，不影响前端构建）：

1. SM3 与已知摘要向量对比。
2. SM4 ECB/CBC 加密→解密往返一致；非法密钥长度 → `ok:false`。
3. SM2 生成密钥对 → 加密→解密往返一致。
4. SM2 签名→验签通过；篡改签名 → 验签失败。

构建期 `vue-tsc --noEmit` 保证类型（`npm run build`）。

## 数据与状态

- 面板参数（SM4 密钥/模式、SM2 密钥对）为面板内部 ref + sm.ts 模块级共享 store，均为内存态，不持久化。
- 输入文本仍由 TextHub 顶层持有，不持久化。

## 边界情况

- 空输入 / 全空格：空态占位，不崩（现有逻辑）。
- 非法 hex / SM4 密钥非 16 字节 / 缺少密钥：`ok:false` + 明确中文错误提示。
- SM4 Base64 密文往返：base64 编解码在封装层处理。
- SM2 密文/签名格式不合法（非 hex、长度不足、点不在曲线上）：`ok:false` + 提示。

## 样式

仅用语义 token（`bg-card` / `bg-accent` / `text-destructive` / `border-border` / `bg-primary` 等）；面板统一 `rounded-lg border` 卡片 + `border-b` 标题栏 + `text-xs uppercase tracking-wider` 小标题；错误横幅 `border-destructive/50 bg-destructive/10 text-destructive`；交互元素带 `focus-visible:ring-2`。全部复用现有组件既成样式。

## 测试与质量

- 算法层纯函数，`scripts/verify-sm.ts` 校验关键向量与往返。
- `vue-tsc --noEmit` 类型检查。
- 不新增独立测试框架，与项目现状一致。

## 路由与入口

- 不改路由、不改首页；功能通过文本处理中台「国密」大类进入。
- 无网络运行，全部本地执行。

## 不做的事

- 不采用 GmSSL-Nodejs（架构不兼容）。
- 不做 SM2 密钥交换（elliptic-curve ECDH 形式）——本期仅加密/解密 + 签名/验签。
- 不做硬件/证书/CA 相关能力。
- 不做密文分块与流式超大文本；SM2 密文面向常规文本长度。
- 不持久化密钥或输入。