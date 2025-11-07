// === Config interna ===
// Cambia la URL si tu API corre en otro host/puerto.
const API_BASE = "https://pdfc-9xdx.onrender.com";
const API_COMPRESS = `${API_BASE}/compress`;

// === Utilidades UI ===
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);
const formatKB = (kb) => {
  const v = parseFloat(kb);
  if (isNaN(v)) return "-";
  return v >= 1024 ? (v/1024).toFixed(2) + " MB" : Math.round(v) + " KB";
};
const toast = (msg, type="ok") => {
  const wrap = $("#toasts");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=> t.remove(), 4000);
};
const setTimeline = (index) => {
  const steps = $$("#timeline .step");
  steps.forEach((s,i)=> s.classList.toggle("active", i<=index));
};

const setLoading = (isLoading) => {
  const btn = $("#btn");
  const spn = btn.querySelector(".spinner");
  const txt = $("#btnText");
  if (isLoading) {
    btn.classList.add("loading");
    btn.disabled = true;
    spn.style.display = "inline-block";
    txt.textContent = "Trabajando…";
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
    spn.style.display = "none";
    txt.textContent = "Comprimir PDF";
  }
};

const showProgress = (show=true) => {
  $("#progressWrap").classList.toggle("hidden", !show);
};
const setProgress = (pct, label) => {
  $("#progress").style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (label) $("#progressText").textContent = label;
};

const showResult = (meta) => {
  const card = $("#resultCard");
  const box  = $("#resultMeta");
  const dlnk = $("#download");
  box.textContent =
`Original:  ${formatKB(meta.orig)} 
Final:     ${formatKB(meta.final)} 
Perfil:    ${meta.profile || "-"}
DPI:       ${meta.dpi || "-"}
Fase:      ${meta.phase || "-"}
Nota:      ${meta.note || "-"}`;
  dlnk.href = meta.url;
  dlnk.download = meta.filename;
  card.classList.remove("hidden");
  setTimeline(3);
};
const hideResult = ()=> $("#resultCard").classList.add("hidden");

const showError = (err) => {
  $("#errorBox").textContent = String(err || "Error");
  $("#errorCard").classList.remove("hidden");
};
const hideError = () => $("#errorCard").classList.add("hidden");

// === Dropzone ===
const dz = $("#dropzone");
const fileInput = $("#file");
const pick = $("#pick");
const fileInfo = $("#fileInfo");

const updateFileInfo = (f) => {
  if (!f) { fileInfo.textContent = "Sin archivo"; return; }
  const kb = (f.size/1024);
  fileInfo.textContent = `${f.name} · ${formatKB(kb)}`;
};

["dragenter","dragover"].forEach(ev=>{
  dz.addEventListener(ev, (e)=>{ e.preventDefault(); dz.classList.add("drag"); });
});
["dragleave","drop"].forEach(ev=>{
  dz.addEventListener(ev, (e)=>{ e.preventDefault(); dz.classList.remove("drag"); });
});
dz.addEventListener("drop", (e)=>{
  const f = e.dataTransfer.files?.[0];
  if (f && f.type === "application/pdf") {
    fileInput.files = e.dataTransfer.files;
    updateFileInfo(f);
    toast("PDF cargado", "ok");
  } else {
    toast("Selecciona un archivo PDF válido", "warn");
  }
});
pick.addEventListener("click", ()=> fileInput.click());
fileInput.addEventListener("change", ()=> updateFileInfo(fileInput.files[0]));

// === Enhancer toggle ===
const enhToggle = $("#enhance_images");
const enhPane = $("#enhancePane");
enhToggle.addEventListener("change", ()=>{
  enhPane.classList.toggle("hidden", !enhToggle.checked);
});

// === Reset / Cerrar error ===
$("#reset").addEventListener("click", ()=>{
  $("#form").reset();
  fileInput.value = "";
  updateFileInfo(null);
  hideResult();
  hideError();
  setTimeline(0);
  showProgress(false);
});
$("#openAgain").addEventListener("click", ()=>{
  hideResult();
  setTimeline(0);
});
$("#dismiss").addEventListener("click", hideError);

// === Enviar formulario ===
$("#form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  hideError();
  hideResult();

  const file = fileInput.files[0];
  const target = $("#target").value.trim();
  const units  = $("#units").value;
  const pipeline = $("#pipeline").value;
  const color = $("#color").value;
  const init_dpi = $("#init_dpi").value.trim();
  const min_dpi_light = $("#min_dpi_light").value.trim();
  const max_iter = $("#max_iter").value.trim();

  if (!file) { toast("Selecciona un PDF", "warn"); return; }
  if (!target || Number(target) <= 0) { toast("Ingresa un tamaño objetivo válido", "warn"); return; }

  // Construir formdata
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("target", target);
  fd.append("units", units);
  fd.append("pipeline", pipeline);
  fd.append("color", color);
  // flags internos
  fd.append("minus_kb", "220");
  fd.append("fast_web", "1");
  fd.append("enforce", "1");

  if (init_dpi) fd.append("init_dpi", init_dpi);
  if (min_dpi_light) fd.append("min_dpi_light", min_dpi_light);
  if (max_iter) fd.append("max_iter", max_iter);

  if (enhToggle.checked) {
    fd.append("enhance_images", "1");
    fd.append("enh_ppi", ($("#enh_ppi").value || "300"));
    fd.append("enh_contrast", ($("#enh_contrast").value || "1.0"));
    fd.append("enh_sharpness", ($("#enh_sharpness").value || "1.0"));
  }

  // XHR para progreso de subida
  const xhr = new XMLHttpRequest();
  setTimeline(1);
  setLoading(true);
  showProgress(true);
  setProgress(5, "Inicializando…");

  xhr.upload.onprogress = (ev)=>{
    if (ev.lengthComputable) {
      const pct = Math.round((ev.loaded/ev.total)*60); // subida hasta 60%
      setProgress(pct, `Subiendo… ${pct}%`);
    }
  };
  xhr.onreadystatechange = ()=>{
    // Estado 2 = headers recibidos → ya está procesando en el backend
    if (xhr.readyState === 2) {
      setTimeline(2);
      setProgress(75, "Procesando en el servidor…");
    }
  };

  xhr.onerror = ()=> {
    setLoading(false);
    setProgress(0, "Error");
    toast("Error de red", "err");
    showError("Error de red");
  };

  xhr.onload = ()=>{
    setLoading(false);
    if (xhr.status !== 200) {
      const text = xhr.responseText || `HTTP ${xhr.status}`;
      showError(text);
      toast("No se pudo comprimir", "err");
      setTimeline(0);
      return;
    }

    setTimeline(3);
    setProgress(95, "Descargando…");

    // Obtener headers con métricas
    const h = xhr.getAllResponseHeaders().toLowerCase();
    const getH = (k) => {
      const regex = new RegExp(`^${k}:\\s*(.*)$`, "mi");
      const m = h.match(regex); return m ? m[1].trim() : "";
    };

    const origKB = getH("x-original-kb");
    const finalKB = getH("x-final-kb");
    const profile = getH("x-profile");
    const dpi = getH("x-dpi");
    const note = getH("x-note");
    const phase = getH("x-phase");

    // Blob a enlace de descarga
    const blob = xhr.response;
    const url = URL.createObjectURL(blob);
    const outName = (file.name.toLowerCase().endsWith(".pdf") ? "compressed_" + file.name : "compressed.pdf");

    $("#download").href = url;
    $("#download").download = outName;

    showResult({
      url, filename: outName, 
      orig: origKB, final: finalKB, profile, dpi, note, phase
    });

    setProgress(100, "Finalizado");
    toast("¡Listo! PDF comprimido", "ok");
  };

  xhr.open("POST", API_COMPRESS, true);
  xhr.responseType = "blob";
  xhr.send(fd);
});

// Accesibilidad menor
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape") hideError();
});



