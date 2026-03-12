// ======== 基本要素の取得 ========
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");
const sizeRange = document.getElementById("sizeRange");

// ======== 状態管理 ========
let drawing = false;
let strokeColor = colorPicker.value;
let baseStrokeWidth = parseInt(sizeRange.value, 10);

// ======== キャンバス初期化 ========
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ======== 描画処理 ========
canvas.addEventListener("pointerdown", e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", e => {
  if (!drawing) return;
  ctx.lineWidth = baseStrokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.lineTo(e.clientX, e.clientY);
  ctx.stroke();
});

canvas.addEventListener("pointerup", () => {
  drawing = false;
});

// ======== UI 連動 ========
colorPicker.addEventListener("input", () => {
  strokeColor = colorPicker.value;
});

sizeRange.addEventListener("input", () => {
  baseStrokeWidth = parseInt(sizeRange.value, 10);
});
