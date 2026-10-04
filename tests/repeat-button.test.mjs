import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRepeatButton } from '../repeat-button.js';

/**
 * ボタン操作とタイマーを実時間の待機なしで確認する環境を用意する
 *
 * @param {import('node:test').TestContext} context テスト環境
 * @returns {object} ボタン、画面、操作履歴、イベント送信
 */
function buttonFixture(context) {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: window, hidden: false });
  const button = Object.assign(new EventTarget(), { ownerDocument: document, setPointerCapture: () => {} });
  const presses = [];
  const emit = (type, properties = {}) => button.dispatchEvent(Object.assign(new Event(type), {
    button: 0, isPrimary: true, pointerId: 1, detail: 1, ...properties,
  }));
  bindRepeatButton(button, () => presses.push('press'));

  return { button, window, document, presses, emit };
}

test('a short press changes once and keyboard clicks still work after pointer input', (context) => {
  const { presses, emit } = buttonFixture(context);
  emit('pointerdown');
  assert.equal(presses.length, 1);
  context.mock.timers.tick(399);
  assert.equal(presses.length, 1);
  emit('pointerup');
  emit('click');
  context.mock.timers.tick(1000);
  assert.equal(presses.length, 1);
  emit('click', { detail: 0 });
  assert.equal(presses.length, 2);
});

test('holding repeats after a delay and releasing adds no extra click or later changes', (context) => {
  const { presses, emit } = buttonFixture(context);
  emit('pointerdown');
  context.mock.timers.tick(400);
  assert.equal(presses.length, 2);
  context.mock.timers.tick(300);
  assert.equal(presses.length, 5);
  emit('pointerup');
  emit('lostpointercapture');
  emit('click');
  context.mock.timers.tick(1000);
  assert.equal(presses.length, 5);
  emit('pointerdown');
  emit('pointerup');
  emit('click');
  assert.equal(presses.length, 6);
});

// 操作が中断されたとき、待ち時間中と連続変更中の両方で停止を確認する
for (const interruption of ['pointercancel', 'lostpointercapture', 'blur', 'pagehide', 'visibilitychange']) {
  test(`${interruption} stops pending and active repeats`, (context) => {
    const { window, document, presses, emit } = buttonFixture(context);
    const interrupt = () => {
      if (interruption === 'blur' || interruption === 'pagehide') {
        window.dispatchEvent(new Event(interruption));
      } else if (interruption === 'visibilitychange') {
        document.hidden = true;
        document.dispatchEvent(new Event(interruption));
      } else {
        emit(interruption);
      }
    };

    emit('pointerdown');
    interrupt();
    context.mock.timers.tick(1000);
    assert.equal(presses.length, 1);
    document.hidden = false;
    emit('pointerdown');
    context.mock.timers.tick(400);
    context.mock.timers.tick(100);
    assert.equal(presses.length, 4);
    interrupt();
    context.mock.timers.tick(1000);
    assert.equal(presses.length, 4);
  });
}

test('right clicks and secondary pointers do not start or interrupt a hold', (context) => {
  const { presses, emit } = buttonFixture(context);
  emit('pointerdown', { button: 2 });
  emit('pointerdown', { isPrimary: false, pointerId: 2 });
  context.mock.timers.tick(1000);
  assert.equal(presses.length, 0);
  emit('pointerdown');
  emit('pointerup', { pointerId: 2 });
  context.mock.timers.tick(400);
  assert.equal(presses.length, 2);
  emit('pointercancel');
});
