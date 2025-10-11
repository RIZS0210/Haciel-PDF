const input = document.getElementById("pdfInput");
const compressBtn = document.getElementById("compressBtn");
const progressBar = document.getElementById("progressBar");
const statusEl = document.getElementById("status");
const origSizeEl = document.getElementById("originalSize");
const compSizeEl = document.getElementById("compressedSize");
const chosenQualityEl = document.getElementById("chosenQuality");
const downloadLink = document.getElementById("downloadLink");
const viewer = document.getElementById("pdfViewer");
const fileName = document.getElementById("fileName");
const sizeSlider = document.getElementById("sizeSlider");
const sliderValue = document.getElementById("sliderValue");

sizeSlider.addEventListener("input", () => {
  sliderValue.textContent = sizeSlider.value;
});

input.addEventListener("change", () => {
  fileName.textContent = input.files[0] ? input.files[0].name : "Ningún archivo seleccionado";
});

async function renderAndCompress(arrayBuffer, quality) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const newPdf = await PDFLib.PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;

    const imgData = canvas.toDataURL("image/jpeg", quality);
    const imgBytes = await fetch(imgData).then(r => r.arrayBuffer());
    const img = await newPdf.embedJpg(imgBytes);
    const pageNew = newPdf.addPage([viewport.width, viewport.height]);
    pageNew.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });

    progressBar.style.width = `${(i / pdf.numPages) * 100}%`;
  }

  const compressedBytes = await newPdf.save();
  return new Blob([compressedBytes], { type: "application/pdf" });
}

compressBtn.addEventListener("click", async () => {
  const file = input.files[0];
  if (!file) return alert("Selecciona un PDF primero");

  const targetMB = parseFloat(sizeSlider.value);
  const origSizeMB = (file.size / 1024 / 1024).toFixed(2);
  origSizeEl.textContent = `Tamaño original: ${origSizeMB} MB`;
  statusEl.textContent = "Procesando...";

  const arrayBuffer = await file.arrayBuffer();
  let quality = 0.8;
  let lastBlob = null;
  let lastSize = 0;
  let attempts = 0;

  while (attempts < 6) {
    progressBar.style.width = "0%";
    const blob = await renderAndCompress(arrayBuffer, quality);
    const sizeMB = blob.size / 1024 / 1024;
    lastBlob = blob;
    lastSize = sizeMB;
    if (sizeMB <= targetMB || quality <= 0.15) break;
    quality -= 0.15;
    attempts++;
  }

  compSizeEl.textContent = `Tamaño comprimido: ${lastSize.toFixed(2)} MB`;
  chosenQualityEl.textContent = `Calidad final usada: ${quality.toFixed(2)}`;
  statusEl.textContent = "✅ Compresión completada.";

  const url = URL.createObjectURL(lastBlob);
  downloadLink.href = url;
  downloadLink.style.display = "block";
  viewer.src = url;
  viewer.style.display = "block";
});
