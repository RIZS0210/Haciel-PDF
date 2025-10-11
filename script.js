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

async function renderPages(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageImages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    const imgData = canvas.toDataURL("image/jpeg", 1.0); // guardar full calidad
    pageImages.push({ data: imgData, width: viewport.width, height: viewport.height });
    progressBar.style.width = `${(i / pdf.numPages) * 100}%`;
  }
  return pageImages;
}

async function generateCompressedPDF(images, quality) {
  const newPdf = await PDFLib.PDFDocument.create();
  for (const img of images) {
    const imgData = await fetch(img.data).then(r => r.blob());
    const compressedImg = await blobToCompressedJpg(imgData, quality);
    const bytes = await compressedImg.arrayBuffer();
    const embedded = await newPdf.embedJpg(bytes);
    const page = newPdf.addPage([img.width, img.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const compressedBytes = await newPdf.save();
  return new Blob([compressedBytes], { type: "application/pdf" });
}

function blobToCompressedJpg(blob, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          resolve(b);
        },
        "image/jpeg",
        quality
      );
    };
    img.src = url;
  });
}

compressBtn.addEventListener("click", async () => {
  const file = input.files[0];
  if (!file) return alert("Selecciona un PDF primero");

  const targetMB = parseFloat(sizeSlider.value);
  const origSizeMB = (file.size / 1024 / 1024).toFixed(2);
  origSizeEl.textContent = `Tamaño original: ${origSizeMB} MB`;
  statusEl.textContent = "🔄 Procesando páginas...";
  progressBar.style.width = "0%";

  const arrayBuffer = await file.arrayBuffer();
  const pageImages = await renderPages(arrayBuffer); // renderiza una sola vez

  statusEl.textContent = " Ajustando calidad...";

  let low = 0.2;
  let high = 0.9;
  let bestBlob = null;
  let bestSize = Infinity;
  let bestQuality = 0.8;

  // Prueba rápida de compresión con 4 iteraciones
  for (let i = 0; i < 4; i++) {
    const mid = (low + high) / 2;
    const blob = await generateCompressedPDF(pageImages, mid);
    const sizeMB = blob.size / 1024 / 1024;

    if (sizeMB > targetMB) {
      high = mid - 0.05;
    } else {
      bestBlob = blob;
      bestQuality = mid;
      bestSize = sizeMB;
      low = mid + 0.05;
    }

    statusEl.textContent = `Intento ${i + 1}/4 → ${sizeMB.toFixed(2)} MB`;
  }

  compSizeEl.textContent = `Tamaño comprimido: ${bestSize.toFixed(2)} MB`;
  chosenQualityEl.textContent = `Calidad final usada: ${bestQuality.toFixed(2)}`;
  statusEl.textContent = "✅ Compresión completada.";

  const url = URL.createObjectURL(bestBlob);
  downloadLink.href = url;
  downloadLink.style.display = "block";
  viewer.src = url;
  viewer.style.display = "block";
});
