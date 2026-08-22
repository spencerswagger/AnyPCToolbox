// conflict.ts：新名冲突检测与自动补序号
// 名字含扩展名时，增序号插在扩展名之前（见 splitName）——此处 appendNum 处理

/** 返回每个下标是否与其它项同名 */
export function flagConflicts(names: string[]): boolean[] {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return names.map((n) => (counts.get(n) ?? 0) > 1)
}

/** 在不改变传入数组的前提下返回唯一化后的新数组，重复项追加 ` (2)`、` (3)`… */
export function uniquify(names: string[]): string[] {
  const out: string[] = []
  const used = new Set<string>()
  for (const name of names) {
    if (!used.has(name)) {
      out.push(name)
      used.add(name)
      continue
    }
    let k = 2
    let candidate = appendNum(name, k)
    while (used.has(candidate)) {
      k++
      candidate = appendNum(name, k)
    }
    out.push(candidate)
    used.add(candidate)
  }
  return out
}

/** 在扩展名前插入 ` (k)`：`a.jpg` -> `a (2).jpg`；无扩展名则直接在末尾追加 */
function appendNum(name: string, k: number): string {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return `${name} (${k})`
  return `${name.slice(0, idx)} (${k})${name.slice(idx)}`
}