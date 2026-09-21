/**
 * sfx.ts — 効果音（Web Audio API）
 *
 * 出典: GDD §12-4
 *   - **Web Audio API のみ。`<audio>` 要素は使わない**（再生遅延が数十〜百ms 出る）
 *   - 最初のユーザー操作で `AudioContext.resume()`
 *   - SE はジャンプ / 着地 / 死亡 / クリア / ベスト更新の5種。**BGM は無し**
 *
 * 波形はすべてコード生成（8bit ブリップ = 矩形波、死亡 = ノイズ）。
 * 外部アセットを読まないので `decodeAudioData` の完了待ちが不要で、
 * プレイ中に初回デコードが走ってスタッターする事故が構造的に起きない。
 */

import type { SfxKind } from './app'

type Ctor = typeof AudioContext

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  enabled = true

  /** 最初のユーザー操作で呼ぶ。以降は何度呼んでも安全 */
  unlock(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const W = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
      const C = W.AudioContext ?? W.webkitAudioContext
      if (!C) return
      try {
        this.ctx = new C()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.18
        this.master.connect(this.ctx.destination)
      } catch {
        this.ctx = null
        return
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  play(kind: SfxKind): void {
    if (!this.enabled || !this.ctx || !this.master) return
    switch (kind) {
      case 'JUMP':
        this.blip([440, 880], 0.07)
        break
      case 'LAND':
        this.blip([220, 165], 0.05)
        break
      case 'DEATH':
        this.noise(0.22)
        break
      case 'CLEAR':
        this.blip([523, 659, 784, 1047], 0.36)
        break
      case 'BEST':
        this.blip([784, 1047], 0.14)
        break
    }
  }

  /** 矩形波の音階を順に鳴らす（8bit ブリップ） */
  private blip(freqs: readonly number[], dur: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t0 = ctx.currentTime
    const step = dur / freqs.length
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + step * i))
    gain.gain.setValueAtTime(0.9, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    osc.connect(gain)
    gain.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur)
  }

  /** ホワイトノイズ（死亡） */
  private noise(dur: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    // 演出専用の波形生成。ゲームロジックには一切関与しない
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf
    gain.gain.value = 0.7
    src.connect(gain)
    gain.connect(master)
    src.start()
  }
}
