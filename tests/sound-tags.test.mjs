import test from 'node:test';
import assert from 'node:assert/strict';
import { sounds } from '../sounds.js';
import { classifySound, soundTagChoices, soundTagLabels, matchesSoundTags } from '../sound-tags.js';
import { soundLengths } from '../sound-lengths.js';

const byKey = new Map(sounds.map((sound) => [sound.key, sound]));

test('every sound has complete shared tags and measured length independent of display numbering', () => {
  assert.equal(Object.keys(soundLengths).length, sounds.length);

  // 未分類や別語彙を残さず、表示番号を変えても役割と高低が同じになることを確認する
  for (const sound of sounds) {
    assert.deepEqual(classifySound({ ...sound, id: 999 }), sound.tags);
    assert.ok(soundLengths[sound.key] > 0 && soundLengths[sound.key] <= sound.duration, sound.name);

    // 配列の用途を含め、すべてのタグが共通の選択肢に含まれることを確認する
    for (const [field, choices] of Object.entries(soundTagChoices)) {
      const values = field === 'uses' ? sound.tags.uses : [sound.tags[field]];
      assert.ok(values.length > 0, sound.name);
      assert.ok(values.every((value) => Object.hasOwn(choices, value)), `${sound.name}: ${field}`);
    }
  }
});

test('tags distinguish real and electronic versions, layered bodies, high and low voices, and swells', () => {
  assert.equal(byKey.get(20).tags.source, 'real');
  assert.equal(byKey.get(82).tags.source, 'electronic');
  assert.equal(byKey.get(6).tags.source, 'hybrid');
  assert.equal(byKey.get(89).tags.source, 'hybrid');

  // 同じ役割でも高低の掛け合いに必要な組み合わせは区別する
  for (const [high, low] of [[20, 22], [82, 84], [29, 30], [35, 36], [96, 97], [98, 99]]) {
    assert.equal(byKey.get(high).tags.register, 'high');
    assert.equal(byKey.get(low).tags.register, 'low');
    assert.equal(byKey.get(high).tags.role, byKey.get(low).tags.role);
  }

  assert.equal(byKey.get(16).tags.attack, 'hit');
  assert.equal(byKey.get(72).tags.attack, 'swell');
  assert.equal(byKey.get(72).tags.source, 'real');
  assert.deepEqual(byKey.get(72).tags.uses, ['transition']);
  assert.equal(byKey.get(8).tags.register, 'broad');
  assert.equal(byKey.get(8).tags.length, 'short');
});

test('tag filters combine all conditions and include multi-purpose instruments', () => {
  const filters = { source: 'electronic', length: 'short', attack: 'hit', uses: 'fill', register: 'all' };
  assert.equal(matchesSoundTags(byKey.get(47), filters), true);
  assert.equal(matchesSoundTags(byKey.get(50), filters), true);
  assert.equal(matchesSoundTags(byKey.get(20), filters), false);
  assert.equal(matchesSoundTags(byKey.get(72), { uses: 'pulse' }), false);
  assert.equal(matchesSoundTags(byKey.get(94), { uses: 'backbeat', source: 'real' }), true);
  assert.deepEqual(soundTagLabels(byKey.get(47)), ['金属の打楽器', '高い', '短い', '電子音', '打撃', 'アクセント', 'フィル']);
});
