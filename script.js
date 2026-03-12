const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const scrollArea = document.querySelector(".scroll-area");

const toolbarButtons = document.querySelectorAll(".tool-btn");
const colorPicker = document.getElementById("colorPicker");
const sizeRange = document.getElementById("sizeRange");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const clearBtn = document.getElementById("clearBtn");
const imageInput = document.getElementById("imageInput");

let currentTool = "pen";
let drawing = false;

let strokeColor = colorPicker.value;
let baseStrokeWidth = parseInt(sizeRange.value, 10);

let undoStack = [];
let redoStack = [];

// ======== 無限スクロール用巨大キャンバス ========
canvas.width = 2000;
canvas.height = 80000;

// ======== ズーム・パン ========
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isPinchingCanvas = false;
let lastPinchDist = 0;

// ======== 選択範囲 ========
let selection = null;
let isDraggingSelection = false;
let selectionDragOffset = { x: 0, y: 0 };
let isPinchingSelection = false;
let lastSelectionPinchDist = 0;

// 初期状態保存
pushUndo();

// ======== ツール切り替え ========
toolbarButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    toolbarButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
  });
});
document.querySelector('[data-tool="pen"]').classList.add("active");

// ======== 色・太さ ========
colorPicker.addEventListener("input", () => strokeColor = colorPicker.value);
sizeRange.addEventListener("input", () => baseStrokeWidth = parseInt(sizeRange.value, 10));

// ======== Pointer Events ========
canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);

function pointerDown(e) {
  const pos = getCanvasPos(e);

  // ======== 選択範囲を掴む ========
  if (selection) {
    const sx = selection.x + selection.offsetX;
    const sy = selection.y + selection.offsetY;
    const sw = selection.w * selection.scale;
    const sh = selection.h * selection.scale;

    if (pos.x >= sx && pos.x <= sx + sw && pos.y >= sy && pos.y <= sy + sh) {
      drawing = true;
      isDraggingSelection = true;
      selectionDragOffset = { x: pos.x - sx, y: pos.y - sy };
      return;
    }
  }

  drawing = true;
  pushUndo();

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function pointerMove(e) {
  const pos = getCanvasPos(e);
  const touches = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

  // ======== 選択範囲のピンチ拡大縮小 ========
  if (selection && e.pointerType === "touch" && touches.length >= 2) {
    const t1 = touches[0];
    const t2 = touches[1];
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!isPinchingSelection) {
      isPinchingSelection = true;
      lastSelectionPinchDist = dist;
      return;
    }

    const delta = dist / lastSelectionPinchDist;
    lastSelectionPinchDist = dist;

    selection.scale *= delta;
    redrawAll();
    return;
  }

  // ======== 選択範囲の移動 ========
  if (selection && isDraggingSelection) {
    selection.offsetX = pos.x - selectionDragOffset.x;
    selection.offsetY = pos.y - selectionDragOffset.y;
    redrawAll();
    return;
  }

  // ======== 通常描画 ========
  if (!drawing) return;

  const pressure = e.pressure || 0.5;
  const strokeWidth = (baseStrokeWidth * pressure) / scale;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = strokeColor;
  }

  if (currentTool === "highlighter") {
    ctx.globalAlpha = 0.3;
  } else {
    ctx.globalAlpha = 1.0;
  }

  ctx.lineWidth = strokeWidth;
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function pointerUp() {
  drawing = false;
  isDraggingSelection = false;
  isPinchingSelection = false;
  ctx.globalAlpha = 1.0;
}

// ======== 座標変換（ズーム・パン対応） ========
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top + scrollArea.scrollTop;

  return {
    x: (rawX - offsetX) / scale,
    y: (rawY - offsetY) / scale
  };
}

// ======== 選択範囲描画 ========
function drawSelection() {
  if (!selection) return;

  ctx.save();
  ctx.translate(selection.x + selection.offsetX, selection.y + selection.offsetY);
  ctx.scale(selection.scale, selection.scale);

  ctx.putImageData(selection.imageData, 0, 0);

  ctx.strokeStyle = "#007aff";
  ctx.lineWidth = 2 / selection.scale;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(0, 0, selection.w, selection.h);

  ctx.restore();
}

// ======== 選択範囲確定 ========
function commitSelection() {
  if (!selection) return;

  pushUndo();

  ctx.save();
  ctx.translate(selection.x + selection.offsetX, selection.y + selection.offsetY);
  ctx.scale(selection.scale, selection.scale);
  ctx.putImageData(selection.imageData, 0, 0);
  ctx.restore();

  selection = null;
  redrawAll();
}

// ======== Undo / Redo ========
function pushUndo() {
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (undoStack.length <= 1) return;
  redoStack.push(undoStack.pop());
  redrawFromUndo();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(redoStack.pop());
  redrawFromUndo();
}

function redrawFromUndo() {
  const img = new Image();
  img.src = undoStack[undoStack.length - 1];
  img.onload = () => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    redrawAll();
  };
}

function redrawAll() {
  redrawFromUndo();
  drawSelection();
}
