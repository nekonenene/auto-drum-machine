/**
 * 押した瞬間に実行し、長押し中は待ち時間の後に繰り返す
 *
 * @param {HTMLButtonElement} button 操作するボタン
 * @param {() => void} onPress 1回分の操作
 * @returns {void}
 */
export function bindRepeatButton(button, onPress) {
  const document = button.ownerDocument;
  const window = document.defaultView;
  let delayTimer;
  let repeatTimer;
  let pointerId = null;
  let pointerClickPending = false;

  /**
   * 指やマウスを離したとき、または画面から離れたときに連続操作を止める
   *
   * @returns {void}
   */
  function stopRepeating() {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
    pointerId = null;
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary) {

      return;
    }

    stopRepeating();
    pointerId = event.pointerId;
    pointerClickPending = true;
    button.setPointerCapture(pointerId);
    onPress();
    delayTimer = setTimeout(() => {
      onPress();
      repeatTimer = setInterval(onPress, 100);
    }, 400);
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
    button.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) {
        stopRepeating();
      }
    });
  });

  button.addEventListener('click', (event) => {
    // ポインター操作後のclickでは二重に実行せず、キーボード操作には対応する
    if (event.detail === 0 || !pointerClickPending) {
      onPress();
    }

    pointerClickPending = false;
  });
  button.addEventListener('contextmenu', (event) => {
    if (pointerId !== null) {
      event.preventDefault();
    }
  });
  window.addEventListener('blur', stopRepeating);
  window.addEventListener('pagehide', stopRepeating);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRepeating();
    }
  });
}
