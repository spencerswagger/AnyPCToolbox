// diff.ts：字符级差异，返回带类型的文本段，供预览高亮（增绿删红）
export type DiffType = 'same' | 'add' | 'del'
export interface DiffSegment { type: DiffType; text: string }

export function diffSegments(oldName: string, newName: string): DiffSegment[] {
  if (oldName === newName) return [{ type: 'same', text: newName }]
  if (!oldName) return [{ type: 'add', text: newName }]
  if (!newName) return [{ type: 'del', text: oldName }]
  // LCS 最长公共子序列
  const a = [...oldName]
  const b = [...newName]
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const segs: DiffSegment[] = []
  let i = 0
  let j = 0
  let bufSame = ''
  let bufAdd = ''
  let bufDel = ''
  const flush = (): void => {
    if (bufSame) { segs.push({ type: 'same', text: bufSame }); bufSame = '' }
    if (bufDel) { segs.push({ type: 'del', text: bufDel }); bufDel = '' }
    if (bufAdd) { segs.push({ type: 'add', text: bufAdd }); bufAdd = '' }
  }
  while (i < n && j < m) {
    if (a[i] === b[j]) { flush(); bufSame += a[i]; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { flush(); bufDel += a[i]; i++ }
    else { flush(); bufAdd += b[j]; j++ }
  }
  while (i < n) { bufDel += a[i]; i++ }
  while (j < m) { bufAdd += b[j]; j++ }
  flush()
  return segs
}