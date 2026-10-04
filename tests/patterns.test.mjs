import test from 'node:test';
import assert from 'node:assert/strict';
import { patterns } from '../dist/patterns-data.js';
import { buildPatterns } from '../tools/create-patterns.mjs';
import { TICKS_PER_BEAT, soundByKey, analyzePattern, finalizePattern, rhythmFingerprint, rhythmSimilarity, trivialVariant, createVariation, validatePatterns } from '../dist/pattern-model.js';
import { PatternTransport, auditionSequence, voiceTiming } from '../dist/pattern-player.js';
import { AutomaticPerformance } from '../dist/pattern-performance.js';

test('saved library has exactly 100 of each 4/4 purpose, stable performances, and no trivial variants', () => {
  assert.equal(patterns.length, 300);
  validatePatterns(patterns);
  assert.deepEqual(buildPatterns(), patterns);

  // 音色の差し替えや強弱だけで数を水増しせず、用途ごとの保存件数を確認する
  for (const purpose of ['basic', 'intro', 'fill']) {
    const saved = patterns.filter((pattern) => pattern.purpose === purpose);
    const prefix = { basic: 'b', intro: 'i', fill: 'o' }[purpose];
    assert.equal(saved.length, 100);
    assert.deepEqual(saved.map((pattern) => pattern.id), Array.from({ length: 100 }, (_, index) => `p4-${prefix}-${String(index + 1).padStart(3, '0')}`));
    assert.ok(saved.every((pattern) => pattern.meter === 4 && pattern.bars === (purpose === 'intro' ? 1 : 2)));
  }

  const base = patterns[8];
  const replacement = { ...base, events: base.events.map((event) => ({ ...event, soundKey: event.soundKey === 20 ? 22 : 20 })) };
  const quiet = { ...base, events: base.events.map((event) => ({ ...event, velocity: event.velocity * .5 })) };
  const tinyChange = { ...base, events: base.events.map((event, index) => ({ ...event, velocity: event.velocity * (index % 2 ? 1.01 : .99) })) };
  assert.equal(rhythmFingerprint(base), rhythmFingerprint(replacement));
  assert.equal(rhythmFingerprint(base), rhythmFingerprint(quiet));
  assert.ok(trivialVariant(base, tinyChange));
  assert.throws(() => validatePatterns([base, { ...tinyChange, id: 'duplicate' }]), /重複|強弱/);
});

test('all saved patterns use the same independent assessment after arranging their performances', () => {
  const metalLevels = new Set();

  // 保存された評価を全件の演奏から照合し、激しさと金属感を独立に揃える
  for (const pattern of patterns) {
    const assessment = analyzePattern(pattern);
    assert.equal(pattern.intensity, assessment.intensity, pattern.id);
    assert.equal(pattern.metallic, assessment.metallic, pattern.id);
    assert.equal(pattern.center, assessment.center, pattern.id);
    assert.deepEqual(pattern.metrics, assessment.metrics, pattern.id);
    metalLevels.add(pattern.metallic);
  }

  assert.deepEqual([...metalLevels].sort(), [1, 2, 3, 4, 5]);
});

test('the library uses every catalog sound and gives each base a broader audible ensemble', () => {
  const audibleKeys = new Set(patterns.flatMap((pattern) => pattern.events.filter((event) => event.velocity >= .4).map((event) => event.soundKey)));
  assert.deepEqual([...audibleKeys].sort((first, second) => first - second), [...soundByKey.keys()].sort((first, second) => first - second));
  assert.ok(patterns.filter((pattern) => pattern.purpose === 'basic').every((pattern) => pattern.usedSoundKeys.length >= 6));
});

test('intros may share a pickup rhythm while IDs and base and fill duplicates remain checked', () => {
  const base = patterns[0];
  const secondBase = patterns[1];
  const intro = patterns.find((pattern) => pattern.derivedFrom === base.id && pattern.purpose === 'intro');
  const shared = finalizePattern({ ...intro, id: 'shared-intro', derivedFrom: secondBase.id });
  validatePatterns([base, secondBase, intro, shared]);
  validatePatterns([base, secondBase, shared, intro]);
  assert.throws(() => validatePatterns([base, intro, { ...shared, id: intro.id }]), /重複/);
  assert.throws(() => validatePatterns([base, { ...base, id: 'duplicate-base' }]), /重複|強弱/);
  const fill = patterns.find((pattern) => pattern.derivedFrom === base.id && pattern.purpose === 'fill');
  assert.throws(() => validatePatterns([base, fill, { ...fill, id: 'duplicate-fill' }]), /重複|強弱/);
});

test('two-bar bases develop the second bar and the electronic groove keeps a clear backbeat across the loop', () => {
  const barTicks = 4 * TICKS_PER_BEAT;

  // 音色や全体音量だけでなく、2小節目の発音位置・発音数が変わっていることを確認する
  for (const base of patterns.filter((pattern) => pattern.purpose === 'basic')) {
    const firstBar = base.events.filter((event) => event.tick < barTicks).map((event) => event.tick);
    const secondBar = base.events.filter((event) => event.tick >= barTicks).map((event) => event.tick - barTicks);
    assert.notDeepEqual(firstBar, secondBar, base.id);
    assert.ok(base.tags.includes('two-bar'));
  }

  const electronic = patterns.find((pattern) => pattern.id === 'p4-b-017');
  assert.deepEqual(electronic.events.filter((event) => event.soundKey === 8).map((event) => event.tick / TICKS_PER_BEAT), [1, 3, 5, 7]);
  assert.ok([0, barTicks].every((tick) => electronic.events.some((event) => event.soundKey === 2 && event.tick === tick)));
  assert.ok(electronic.events.filter((event) => event.soundKey === 59).length <= 1);
  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start([electronic], true);

  // 2周分の演奏で、2小節目の4拍目から次の1拍目への間隔が崩れないことを確認する
  for (let tick = 0; tick < 820; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  const kicks = fixture.hits.filter((hit) => hit.event.soundKey === 2 && hit.event.tick === 0);
  assert.deepEqual(kicks.map((hit) => Number(hit.start.toFixed(2))), [.06, 4.06, 8.06]);
  const finalSnare = fixture.hits.find((hit) => hit.event.soundKey === 8 && hit.event.tick === 7 * TICKS_PER_BEAT);
  assert.ok(Math.abs(kicks[1].start - finalSnare.start - .5) < 1e-9);
});

test('sparse grooves keep a two-beat or four-beat kick foundation through their fills', () => {
  const revisedNumbers = [12, ...Array.from({ length: 16 }, (_, index) => index + 21)];
  const downbeats = [0, 2, 4, 6].map((beat) => beat * TICKS_PER_BEAT);

  // 余白のあるフレーズでも1・3拍のキックを両小節に置き、フィルで拍の土台を失わない
  for (const number of revisedNumbers) {
    const suffix = String(number).padStart(3, '0');

    // 基本と対応するフィルを同じ拍位置で確認する
    for (const prefix of ['b', 'o']) {
      const pattern = patterns.find((item) => item.id === `p4-${prefix}-${suffix}`);
      const kicks = pattern.events.filter((event) => [71, 101].includes(event.soundKey));
      assert.ok(downbeats.every((tick) => kicks.some((event) => event.tick === tick && event.velocity >= .35)), pattern.id);
    }

    if (number >= 21 && number <= 28) {
      const base = patterns.find((item) => item.id === `p4-b-${suffix}`);
      assert.ok([1, 3, 5, 7].every((beat) => base.events.some((event) => event.soundKey === 25 && event.tick === beat * TICKS_PER_BEAT)), base.id);
    }
  }
});

test('intros start on beat one except accepted pickups; transition fills keep the pulse', () => {
  const acceptedPickups = new Set(['p4-i-006', 'p4-i-007', 'p4-i-011']);

  // 出だしの入口と小節長、展開フィルの拍の足場を演奏イベントから確認する
  for (const pattern of patterns.filter((pattern) => pattern.purpose !== 'basic')) {
    const totalTicks = pattern.bars * pattern.meter * TICKS_PER_BEAT;
    assert.ok(patterns.some((base) => base.id === pattern.derivedFrom && base.purpose === 'basic'));

    if (pattern.purpose === 'intro') {
      assert.equal(totalTicks, 384);
      assert.equal(pattern.fillRange.endTick, totalTicks);
      assert.ok(!pattern.tags.includes('two-bar'));
      const entryTick = pattern.events[0].tick;
      assert.equal(entryTick, pattern.fillRange.startTick, pattern.id);
      assert.equal(entryTick === 0, !acceptedPickups.has(pattern.id), pattern.id);
      assert.equal(pattern.groove, patterns.find((base) => base.id === pattern.derivedFrom).groove);
      assert.ok(pattern.events.every((event) => event.tick >= pattern.fillRange.startTick));
      const mainTicks = [...new Set(pattern.events.filter((event) => soundByKey.get(event.soundKey).tags.attack !== 'swell')
        .map((event) => event.tick))];
      assert.ok(mainTicks.length > 0, pattern.id);
      assert.ok(!pattern.events.some((event) => event.soundKey === 64), pattern.id);
      assert.ok(pattern.tags.includes('opening') && pattern.tags.includes('build-up'), pattern.id);
    } else {
      const base = patterns.find((item) => item.id === pattern.derivedFrom);
      assert.deepEqual(pattern.events.filter((event) => event.tick < pattern.fillRange.startTick), base.events.filter((event) => event.tick < pattern.fillRange.startTick));
      assert.ok(pattern.events.at(-1).tick >= totalTicks - 32, pattern.id);
      const finalEvents = pattern.events.filter((event) => event.tick >= pattern.fillRange.startTick);
      assert.ok(Math.max(...finalEvents.filter((event) => event.tick >= totalTicks - 32).map((event) => event.velocity)) >= .85, pattern.id);
      assert.notEqual(rhythmFingerprint(pattern), rhythmFingerprint(base));
      assert.ok(pattern.tags.includes('build-up'));

      if (pattern.name.includes('同時打ちの入口') || pattern.name.includes('裏から厚い着地')) {
        const finalTick = pattern.events.at(-1).tick;
        assert.ok(pattern.events.filter((event) => event.tick === finalTick).length >= 2, pattern.id);
      }
    }
  }
});

test('each additional quartet has different prominent voices and phrase density', () => {
  const basics = patterns.filter((pattern) => pattern.purpose === 'basic');

  // 追加80件は4件内の全組み合わせで、聴き分けの主役となる音色を複数持つ
  for (let start = 20; start < 100; start += 4) {
    const quartet = basics.slice(start, start + 4);
    const voices = quartet.map((pattern) => new Set(pattern.events.filter((event) => event.velocity >= .5).map((event) => event.soundKey)));

    // 弱い飾りを1音差しただけの差ではなく、互いに3音色以上の主役が異なることを確認する
    for (const [index, keys] of voices.entries()) {
      voices.slice(index + 1).forEach((other) => {
        assert.ok([...keys].filter((key) => !other.has(key)).length >= 3, quartet[index].id);
        assert.ok([...other].filter((key) => !keys.has(key)).length >= 3, quartet[index].id);
      });
    }

    const densities = quartet.map((pattern) => pattern.metrics.density);
    assert.ok(Math.max(...densities) - Math.min(...densities) >= .5, quartet[0].id);
  }
});

test('scores stay independent of loudness and phrase length; metallic and electronic are distinct', () => {
  const base = { ...patterns[0], bars: 1, events: patterns[0].events.filter((event) => event.tick < 384) };
  const twice = { ...base, bars: 2, events: [...base.events, ...base.events.map((event) => ({ ...event, tick: event.tick + 384 }))] };
  const quiet = { ...base, events: base.events.map((event) => ({ ...event, velocity: event.velocity * .3 })) };
  const firstScore = analyzePattern(base);
  const twiceScore = analyzePattern(twice);
  assert.equal(firstScore.intensity, twiceScore.intensity);
  assert.equal(firstScore.metallic, twiceScore.metallic);
  Object.keys(firstScore.metrics).forEach((key) => assert.ok(Math.abs(firstScore.metrics[key] - twiceScore.metrics[key]) < 1e-12, key));
  assert.equal(analyzePattern(base).intensity, analyzePattern(quiet).intensity);
  assert.equal(analyzePattern(base).metallic, analyzePattern(quiet).metallic);
  assert.ok(patterns.some((pattern) => pattern.intensity <= 2 && pattern.metallic === 5));
  assert.ok(patterns.some((pattern) => pattern.intensity === 5 && pattern.metallic === 1));
  assert.equal(patterns.find((pattern) => pattern.id === 'p4-b-017').metallic, 1);
  assert.equal(patterns.find((pattern) => pattern.id === 'p4-b-020').groove, 'straight');
  assert.ok(patterns.find((pattern) => pattern.id === 'p4-b-020').tags.includes('triplet-fill'));
  assert.ok(patterns.some((pattern) => pattern.events.some((event) => event.tick % 24 !== 0)));
});

test('similarity exposes shared rhythm and automatic variants save reproducible changes', () => {
  const base = patterns[0];
  assert.equal(rhythmSimilarity(base, base), 1);
  assert.equal(rhythmSimilarity(base, { ...base, meter: 3 }), 0);
  const generated = createVariation(base, 1);
  assert.deepEqual(generated, createVariation(base, 1));
  assert.notEqual(rhythmFingerprint(base), rhythmFingerprint(generated));
  assert.ok(!trivialVariant(base, generated));
  assert.equal(generated.derivedFrom, base.id);
  assert.ok(rhythmSimilarity(base, generated) > .3);
});

test('automatic variations preserve the beat foundation, landing, and swung subdivisions', () => {

  // 各骨格から複数の案を作り、装飾を変えても接続の軸が動かないことを確認する
  for (const base of patterns.filter((pattern) => pattern.purpose === 'basic')) {
    const lastBeatTick = (base.meter * base.bars - 1) * TICKS_PER_BEAT;
    const anchors = base.events.filter((event) => ['kick', 'snare', 'clap', 'rim'].includes(soundByKey.get(event.soundKey).tags.role)
      || event.tick === 0 || event.tick >= lastBeatTick);

    // 生成番号を変えても頭・バックビート・最後の返しをそのまま残す
    for (const serial of [1, 2, 7, 31]) {
      const variation = createVariation(base, serial);
      anchors.forEach((event) => assert.ok(variation.events.some((candidate) => JSON.stringify(candidate) === JSON.stringify(event)), base.id));
      assert.equal(new Set(variation.events.map((event) => `${event.tick}/${event.soundKey}`)).size, variation.events.length, base.id);
      assert.ok(variation.events.every((event) => event.tick >= 0 && event.tick < lastBeatTick + TICKS_PER_BEAT), base.id);

      if (base.groove !== 'straight') {
        base.events.forEach((event) => {
          if (!variation.events.some((candidate) => candidate.tick === event.tick && candidate.soundKey === event.soundKey)) {
            assert.ok(variation.events.some((candidate) => candidate.soundKey === event.soundKey && (candidate.tick - event.tick) % 16 === 0), base.id);
          }
        });
      }
    }
  }
});

test('reverse and swell pickups fit the full sound to the next downbeat at slow and fast tempos', () => {
  const pickups = patterns.flatMap((pattern) => pattern.events
    .filter((event) => soundByKey.get(event.soundKey).tags.attack === 'swell')
    .map((event) => ({ pattern, event })));
  assert.ok(pickups.some(({ pattern }) => pattern.purpose === 'intro'));
  assert.ok(pickups.some(({ pattern }) => pattern.purpose === 'fill'));

  // 助走のピークを途中で切らず、40〜240BPMの各境界へPCM全体を収める
  for (const { pattern, event } of pickups) {
    assert.notEqual(pattern.purpose, 'basic');
    assert.equal(event.tick + event.gateTicks, pattern.bars * pattern.meter * TICKS_PER_BEAT, pattern.id);

    // 再生速度と発音長が同じ拍長を表し、終端が次の頭と一致することを確認する
    for (const bpm of [40, 110, 240]) {
      const timing = voiceTiming(event, bpm);
      assert.ok(Math.abs(soundByKey.get(event.soundKey).duration / timing.playbackRate - timing.duration) < 1e-9);
      assert.ok(Math.abs(event.tick / TICKS_PER_BEAT * 60 / bpm + timing.duration - pattern.bars * pattern.meter * 60 / bpm) < 1e-9);
    }
  }

  const kick = patterns[0].events.find((event) => event.soundKey === 101);
  assert.equal(voiceTiming(kick, 240).playbackRate, 1);
});

/**
 * 偽の音声時刻で、予約・停止を観測できるトランスポートを用意する
 *
 * @returns {object}
 */
function transportFixture() {
  let time = 0;
  const hits = [];
  const cancellations = [];
  const audio = { now: () => time, schedule: (event, start, bpm) => hits.push({ event, start, bpm }),
    cancel: (now, futureOnly) => {
      cancellations.push({ now, futureOnly });
      hits.filter((hit) => !futureOnly || hit.start >= now).forEach((hit) => { hit.cancelled = true; });
    }, tail: () => .1 };

  return { transport: new PatternTransport(audio), hits, cancellations, setTime: (next) => { time = next; } };
}

const tinyPattern = { id: 'tiny', meter: 4, bars: 1, events: [
  { tick: 0, soundKey: 1, velocity: .8, gateTicks: 24 },
  { tick: 32, soundKey: 5, velocity: .6, gateTicks: 24 },
  { tick: 96, soundKey: 12, velocity: .4, gateTicks: 24 },
] };

test('queued playback follows the current phrase seamlessly in loops, one-shots, and connected sequences', () => {
  const next = { ...tinyPattern, id: 'queued' };

  // 単発・リピート・接続列のいずれも、現在のフレーズの直後へ切り替える
  for (const [sequence, loop] of [[[tinyPattern], false], [[tinyPattern], true], [[tinyPattern, tinyPattern], true]]) {
    const fixture = transportFixture();
    fixture.transport.setBpm(120);
    fixture.transport.start(sequence, loop);
    fixture.setTime(.3);
    fixture.transport.queue([next], true);
    assert.equal(fixture.transport.position().pattern.id, 'tiny');

    // 境界の音を先読みしても、表示は実際の切り替え時刻まで前のままにする
    for (let tick = 30; tick <= 198; tick++) {
      fixture.setTime(tick * .01);
      fixture.transport.pump();
    }

    assert.equal(fixture.transport.position().pattern.id, 'tiny');
    assert.equal(fixture.hits.find((hit) => hit.event.patternId === 'queued').start, 2.06);

    // 切り替えた後の周回でも、1拍目の発音を重複させない
    for (let tick = 199; tick <= 420; tick++) {
      fixture.setTime(tick * .01);
      fixture.transport.pump();
    }

    assert.equal(fixture.transport.position().pattern.id, 'queued');
    assert.equal(fixture.transport.pending, null);
    assert.deepEqual(fixture.hits.filter((hit) => !hit.cancelled && hit.event.tick === 0)
      .map((hit) => [hit.event.patternId, Number(hit.start.toFixed(2))]), [['tiny', .06], ['queued', 2.06], ['queued', 4.06]]);
  }
});

test('replacing a queue cancels pre-scheduled boundary hits and keeps only the latest choice', () => {
  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start([tinyPattern], true);
  fixture.setTime(1.96);
  fixture.transport.pump();
  assert.ok(fixture.hits.some((hit) => hit.start === 2.06));
  fixture.transport.queue([{ ...tinyPattern, id: 'discarded' }]);
  fixture.setTime(1.98);
  fixture.transport.queue([{ ...tinyPattern, id: 'latest' }]);
  fixture.setTime(2.06);
  fixture.transport.pump();
  assert.equal(fixture.transport.position().pattern.id, 'latest');
  assert.deepEqual(fixture.hits.filter((hit) => !hit.cancelled && hit.start === 2.06)
    .map((hit) => hit.event.patternId), ['latest']);
});

test('queues use the end of a later connected phrase or loop and retain a pre-scheduled boundary after BPM changes', () => {
  const longer = { ...tinyPattern, id: 'longer', bars: 2 };

  // 接続列の2番目とループの2周目でも、今のフレーズの終端を使う
  for (const [sequence, boundary] of [[[tinyPattern, longer], 6.06], [[tinyPattern], 4.06]]) {
    const fixture = transportFixture();
    fixture.transport.setBpm(120);
    fixture.transport.start(sequence, true);
    fixture.setTime(2.3);
    fixture.transport.queue([{ ...tinyPattern, id: 'next' }]);

    // 次のフレーズの頭まで時刻を進め、発音の境界を確認する
    for (let tick = 230; tick <= boundary * 100 + 10; tick++) {
      fixture.setTime(tick * .01);
      fixture.transport.pump();
    }

    const first = fixture.hits.find((hit) => !hit.cancelled && hit.event.patternId === 'next');
    assert.ok(Math.abs(first.start - boundary) < 1e-9);
  }

  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start([tinyPattern], true);
  fixture.setTime(1.98);
  fixture.transport.queue([{ ...tinyPattern, id: 'next' }]);
  fixture.transport.setBpm(60);
  fixture.setTime(2.14);
  fixture.transport.pump();
  const starts = fixture.hits.filter((hit) => !hit.cancelled && hit.event.patternId === 'next' && hit.event.tick === 0);
  assert.equal(starts.length, 1);
  assert.ok(Math.abs(starts[0].start - 2.14) < 1e-9);
});

test('queued transitions follow BPM changes, preserve intro rests, and are cleared by stop or immediate start', () => {
  const fixture = transportFixture();
  const intro = { ...tinyPattern, id: 'pickup', events: tinyPattern.events.slice(1) };
  fixture.transport.setBpm(120);
  fixture.transport.start([tinyPattern], true);
  fixture.setTime(.3);
  fixture.transport.queue([intro]);
  fixture.transport.setBpm(60);

  // テンポ変更後の終端へつなぎ、出だしの休符を詰めない
  for (let tick = 30; tick <= 500; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  const first = fixture.hits.find((hit) => !hit.cancelled && hit.event.patternId === 'pickup');
  assert.ok(Math.abs(first.start - (3.82 + 1 / 3)) < 1e-9);
  assert.equal(first.bpm, 60);
  fixture.transport.queue([tinyPattern], true);
  fixture.transport.stop();
  assert.equal(fixture.transport.pending, null);
  const hitCount = fixture.hits.length;
  fixture.setTime(10);
  fixture.transport.pump();
  assert.equal(fixture.hits.length, hitCount);
  fixture.transport.start([tinyPattern], true);
  fixture.transport.queue([intro]);
  fixture.transport.start([{ ...tinyPattern, id: 'immediate' }]);
  assert.equal(fixture.transport.pending, null);
  assert.equal(fixture.transport.position().pattern.id, 'immediate');
  assert.ok(Math.abs(fixture.hits.at(-1).start - 10.06) < 1e-9);
});

test('one-shot and loop schedule exact triplets with no missing or doubled boundary hits', () => {
  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start([tinyPattern]);

  // 4小節分を細かく進め、単発が次の周回を予約しないことを確認する
  for (let tick = 0; tick < 410; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  assert.equal(fixture.hits.length, 3);
  assert.ok(Math.abs(fixture.hits[1].start - fixture.hits[0].start - 1 / 6) < 1e-9);
  assert.equal(fixture.transport.playing, false);
  const loop = transportFixture();
  loop.transport.setBpm(120);
  loop.transport.start([tinyPattern], true);

  // 次の小節の1拍目はちょうど1回だけ予約される
  for (let tick = 0; tick < 220; tick++) {
    loop.setTime(tick * .01);
    loop.transport.pump();
  }

  const starts = loop.hits.filter((hit) => hit.event.tick === 0).map((hit) => hit.start);
  assert.deepEqual(starts.map((start) => Number(start.toFixed(2))), [.06, 2.06]);
  loop.transport.stop();
  assert.equal(loop.cancellations.at(-1).futureOnly, false);
});

test('live BPM changes preserve musical position, cancel future hits, and keep stop effective', () => {
  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start([tinyPattern], true);
  fixture.setTime(.3);
  fixture.transport.pump();
  const before = fixture.transport.beatAt();
  fixture.transport.setBpm(60);
  assert.equal(fixture.transport.beatAt(), before);
  assert.equal(fixture.cancellations.at(-1).futureOnly, true);
  fixture.setTime(.75);
  fixture.transport.pump();
  assert.ok(fixture.hits.some((hit) => hit.bpm === 60 && hit.event.tick === 96));
  fixture.transport.stop();
  const count = fixture.hits.length;
  fixture.setTime(8);
  fixture.transport.pump();
  assert.equal(fixture.hits.length, count);
});

test('connection audition returns to the base after a transition fill; automatic changes land on the boundary', () => {
  const intro = patterns.find((pattern) => pattern.purpose === 'intro');
  const fill = patterns.find((pattern) => pattern.purpose === 'fill');
  assert.deepEqual(auditionSequence(intro, patterns, true).map((pattern) => pattern.id), [intro.id, intro.derivedFrom]);
  const opening = transportFixture();
  opening.transport.setBpm(120);
  opening.transport.start(auditionSequence(intro, patterns, true), true);

  // 冒頭の休符を含めた4拍後に基本へ入り、基本の頭が3小節周期で正確につながることを確認する
  for (let tick = 0; tick < 830; tick++) {
    opening.setTime(tick * .01);
    opening.transport.pump();
  }

  const openingBaseStarts = opening.hits.filter((hit) => hit.event.patternId === intro.derivedFrom && hit.event.tick === 0 && hit.event.soundKey === 101);
  const openingStart = opening.hits.find((hit) => hit.event.patternId === intro.id);
  assert.ok(Math.abs(openingStart.start - (.06 + intro.events[0].tick / TICKS_PER_BEAT * .5)) < 1e-9);
  assert.ok(Math.abs(openingBaseStarts[0].start - 2.06) < 1e-9);
  assert.deepEqual(openingBaseStarts.map((hit) => Number(hit.start.toFixed(2))), [2.06, 8.06]);
  opening.setTime(1.9);
  assert.equal(opening.transport.position().pattern.id, intro.id);
  opening.setTime(2.1);
  assert.equal(opening.transport.position().pattern.id, intro.derivedFrom);

  // すべての出だしで休符を詰めず、開始から4拍後の基本へつなぐ
  for (const delayedIntro of patterns.filter((pattern) => pattern.purpose === 'intro')) {
    const entryTick = delayedIntro.events[0].tick;
    const delayed = transportFixture();
    delayed.transport.setBpm(120);
    delayed.transport.start(auditionSequence(delayedIntro, patterns, true));

    // 無音の入口から基本の頭まで先読み予約する
    for (let tick = 0; tick < 220; tick++) {
      delayed.setTime(tick * .01);
      delayed.transport.pump();
    }

    assert.ok(Math.abs(delayed.hits[0].start - (.06 + entryTick / TICKS_PER_BEAT * .5)) < 1e-9);
    const baseStart = delayed.hits.find((hit) => hit.event.patternId === delayedIntro.derivedFrom && hit.event.tick === 0);
    assert.ok(Math.abs(baseStart.start - 2.06) < 1e-9);
  }

  assert.deepEqual(auditionSequence(fill, patterns, true).map((pattern) => pattern.id), [fill.derivedFrom, fill.id, fill.derivedFrom]);
  assert.deepEqual(auditionSequence(fill, patterns, false), [fill]);
  const connected = transportFixture();
  connected.transport.setBpm(120);
  connected.transport.start(auditionSequence(fill, patterns, true));

  // 基本→フィル→次の基本の1拍目を、休止も重複もなく予約する
  for (let tick = 0; tick < 1210; tick++) {
    connected.setTime(tick * .01);
    connected.transport.pump();
  }

  const baseStarts = connected.hits.filter((hit) => hit.event.patternId === fill.derivedFrom && hit.event.tick === 0 && hit.event.soundKey === 101);
  assert.deepEqual(baseStarts.map((hit) => Number(hit.start.toFixed(2))), [.06, 8.06]);
  const fixture = transportFixture();
  const second = { ...tinyPattern, id: 'next' };
  fixture.transport.setBpm(120);
  fixture.transport.onNext = () => second;
  fixture.transport.start([tinyPattern], true);

  // 4周目の境界で新案へ移り、時刻を詰めたり重複したりしないことを確認する
  for (let tick = 0; tick < 830; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  const starts = fixture.hits.filter((hit) => hit.event.tick === 0);
  assert.deepEqual(starts.map((hit) => Number(hit.start.toFixed(2))), [.06, 2.06, 4.06, 6.06, 8.06]);
  assert.equal(starts.at(-1).event.patternId, 'next');
});

/**
 * 入口と末尾の休符を持つ、自動演奏の小さな関連ライブラリを用意する
 *
 * @returns {object[]} 4拍子の強・弱2組と、3拍子の1組
 */
function performanceLibrary() {
  return [['strong', 5, 4], ['soft', 2, 4], ['waltz', 2, 3]].flatMap(([id, intensity, meter]) => {
    const basic = { ...tinyPattern, id, purpose: 'basic', bars: 2, intensity, meter };

    return [basic,
      { ...basic, id: `${id}-intro`, purpose: 'intro', derivedFrom: id, bars: 1, events: tinyPattern.events.slice(2) },
      { ...basic, id: `${id}-fill`, purpose: 'fill', derivedFrom: id, events: tinyPattern.events.slice(0, 1) }];
  });
}

test('automatic performance uses related intros, six basic bars, and related fills for every saved family', () => {
  // 基本・出だし・フィルのどれを選んでも、同じ関連する基本6小節へつなぐ
  for (const selected of patterns) {
    const performance = new AutomaticPerformance(patterns, () => 0);
    const sequence = performance.start(selected);
    const base = sequence[1];
    assert.equal(base.id, selected.derivedFrom || selected.id);
    assert.equal(sequence[0].purpose, 'intro');
    assert.equal(sequence[0].derivedFrom, base.id);
    assert.deepEqual(sequence.slice(1, 4), [base, base, base]);
    assert.equal(sequence.slice(1, 4).reduce((bars, pattern) => bars + pattern.bars, 0), 6);
    assert.equal(sequence[4].purpose, 'fill');
    assert.equal(sequence[4].derivedFrom, base.id);
  }

  const performance = new AutomaticPerformance(patterns);
  assert.equal(performance.start(createVariation(patterns[0], 1))[1].id, patterns[0].id);
  assert.throws(() => new AutomaticPerformance([patterns[0]]).start(patterns[0]), /関連する/);
});

test('random next basics keep the meter, avoid immediate repeats, and add an intro only when intensity falls', () => {
  const library = performanceLibrary();
  const performance = new AutomaticPerformance(library, () => 0);
  performance.start(library[0]);
  assert.deepEqual(performance.next().map((pattern) => pattern.id), ['soft-intro', 'soft', 'soft', 'soft', 'soft-fill']);
  assert.deepEqual(performance.next('2').map((pattern) => pattern.id), ['soft', 'soft', 'soft', 'soft-fill']);
  assert.deepEqual(performance.next('5').map((pattern) => pattern.id), ['strong', 'strong', 'strong', 'strong-fill']);
  assert.throws(() => performance.next('1'), /指定した激しさ/);
  assert.equal(performance.currentBase.id, 'strong');

  const saved = new AutomaticPerformance(patterns, () => .999999);
  saved.start(patterns[0]);

  // 同じ段階の複数候補でも前と別の基本を選び、段階差は基本同士で判断する
  for (const intensity of ['2', '2', '3', '5', 'all']) {
    const previous = saved.currentBase;
    const sequence = saved.next(intensity);
    assert.notEqual(saved.currentBase.id, previous.id);
    assert.equal(saved.currentBase.meter, previous.meter);
    assert.equal(sequence[0].purpose === 'intro', saved.currentBase.intensity < previous.intensity);
    assert.ok(sequence.every((pattern) => pattern.meter === previous.meter));

    if (intensity !== 'all') {
      assert.equal(saved.currentBase.intensity, Number(intensity));
    }
  }
});

test('continuous performance preserves pickup and trailing rests and schedules each boundary once', () => {
  const library = performanceLibrary();
  const performance = new AutomaticPerformance(library, () => 0);
  const fixture = transportFixture();
  fixture.transport.setBpm(120);
  fixture.transport.start(performance.start(library[0]), false, () => performance.next());

  // 出だし1小節、基本6小節、フィル2小節から弱い基本の出だしを経て、再び強い基本へ進む
  for (let tick = 0; tick <= 3650; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  const starts = fixture.hits.filter((hit) => hit.event.tick === 0).map((hit) => [hit.event.patternId, Number(hit.start.toFixed(2))]);
  assert.deepEqual(starts, [['strong', 2.06], ['strong', 6.06], ['strong', 10.06], ['strong-fill', 14.06],
    ['soft', 20.06], ['soft', 24.06], ['soft', 28.06], ['soft-fill', 32.06], ['strong', 36.06]]);
  assert.deepEqual(fixture.hits.filter((hit) => hit.event.patternId.endsWith('-intro'))
    .map((hit) => Number(hit.start.toFixed(2))), [.56, 18.56]);
  assert.equal(fixture.transport.playing, true);
  assert.equal(fixture.transport.position().pattern.id, 'strong');
  const triplets = fixture.hits.filter((hit) => hit.event.patternId === 'soft' && hit.event.tick === 32);
  assert.ok(Math.abs(triplets[0].start - 20.06 - 1 / 6) < 1e-9);
});

test('automatic boundary lookahead keeps the audible phrase visible and retains the chosen next sequence after BPM changes', () => {
  const library = performanceLibrary();
  const performance = new AutomaticPerformance(library, () => 0);
  const fixture = transportFixture();
  let choices = 0;
  fixture.transport.setBpm(120);
  fixture.transport.start(performance.start(library[0]), false, () => {
    choices++;

    return performance.next();
  });

  // フィル末尾の休符でも次を先読みし、テンポ変更前に選んだ次の基本を保つ
  for (let tick = 0; tick <= 1800; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  assert.equal(choices, 1);
  assert.equal(fixture.transport.position().pattern.id, 'strong-fill');
  assert.equal(fixture.transport.pending.sequence[0].id, 'soft-intro');
  fixture.transport.setBpm(60);

  // 新しいテンポで出だし1小節と基本の頭を予約し、境界に重複がないことを確認する
  for (let tick = 1801; tick <= 2230; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  assert.equal(choices, 1);
  const basicStart = fixture.hits.filter((hit) => !hit.cancelled && hit.event.patternId === 'soft' && hit.event.tick === 0);
  assert.equal(basicStart.length, 1);
  assert.ok(Math.abs(basicStart[0].start - 22.12) < 1e-9);
  assert.equal(basicStart[0].bpm, 60);
  fixture.transport.stop();
  const count = fixture.hits.length;
  fixture.setTime(100);
  fixture.transport.pump();
  assert.equal(fixture.hits.length, count);
  assert.equal(fixture.transport.onSequenceEnd, null);
});

test('manual audition or immediate restart leaves the automatic sequence cleanly', () => {
  const fixture = transportFixture();
  const library = performanceLibrary();
  const performance = new AutomaticPerformance(library, () => 0);
  fixture.transport.setBpm(120);
  fixture.transport.start(performance.start(library[0]), false, () => performance.next());
  fixture.setTime(.3);
  fixture.transport.queue([tinyPattern], true);
  assert.equal(fixture.transport.onSequenceEnd, null);

  // 出だしの終わりから手動試聴へ移り、自動演奏の基本は予約しない
  for (let tick = 30; tick <= 430; tick++) {
    fixture.setTime(tick * .01);
    fixture.transport.pump();
  }

  assert.equal(fixture.transport.position().pattern.id, 'tiny');
  assert.ok(!fixture.hits.some((hit) => !hit.cancelled && hit.event.patternId === 'strong'));
  fixture.transport.start(performance.start(library[0]), false, () => performance.next());
  fixture.transport.start([tinyPattern]);
  assert.equal(fixture.transport.onSequenceEnd, null);
  assert.equal(fixture.transport.pending, null);
});
