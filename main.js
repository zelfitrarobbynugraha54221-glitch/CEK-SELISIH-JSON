let dataMap = {
  selisih: { A:null, B:null, result:null, fileAName:"", fileBName:"", fieldA:null, fieldB:null },
  duplikat: { A:null, B:null, result:null, fileAName:"", fileBName:"", fieldA:null, fieldB:null },
  stok: { A:null, B:null, result:null, fileAName:"", fileBName:"", fieldA:null, fieldB:null }
};

const preferredFields = ["kode_barcode","no_faktur","no_faktur_service","no_faktur_hutang"];

function getShortFileName(fullName){
  const parts = fullName.split(".");
  if(parts.length >= 2){
    return parts.slice(-2).join(".");
  }
  return fullName;
}

function parseJsonFlexible(text){
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  throw new Error("Root bukan array dan tidak ada field 'data' berupa array.");
}

function autoDetectField(arr){
  if(!arr || arr.length===0) return null;
  const keys = Object.keys(arr[0]);
  for(const f of preferredFields){
    if(keys.includes(f)) return f;
  }
  return keys[0]; 
}

function populateFieldSelect(menu, ab, arr){
  const selectEl = document.getElementById(`field${ab}_${menu}`);
  if(!selectEl) return;

  selectEl.innerHTML = "";
  const keys = arr && arr.length > 0 ? Object.keys(arr[0]) : [];
  keys.forEach(k=>{
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    selectEl.appendChild(opt);
  });

  const detected = autoDetectField(arr);
  if(detected) selectEl.value = detected;

  dataMap[menu][`field${ab}`] = selectEl.value;

  selectEl.addEventListener("change", ()=>{
    dataMap[menu][`field${ab}`] = selectEl.value;
    updateResult(menu);
  });
}

function readFile(input, menu, ab){
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const arr = parseJsonFlexible(e.target.result);
      dataMap[menu][ab] = arr;
      populateFieldSelect(menu, ab, arr);
      updateResult(menu);
    }catch(err){
      alert("File JSON tidak valid! Detail: " + err.message);
    }
  };
  reader.readAsText(file);
}

function renderTable(id, data){
  if(!data || data.length===0) 
    return "<p class='empty'>⚠ Tidak ada data</p>";
  const rows = data.map(x => `<tr><td>${x}</td></tr>`).join("");
  return `
    <div>
      <span class="badge">${data.length}</span>
      <table id="${id}">
        <thead><tr><th>Nilai</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function findDuplicates(arr){
  const count = {};
  for(const x of arr){ count[x] = (count[x]||0)+1; }
  return Object.keys(count).filter(k => count[k] > 1);
}

function getKey(arr, field){
  return arr.map(item => item?.[field]).filter(Boolean);
}

function updateResult(menu){
  const { A:dataA, B:dataB, fieldA, fieldB } = dataMap[menu];
  if(!dataA) return;

  let onlyInA=[], onlyInB=[], dupA=[], dupB=[], stok0=[], stokAdaTapiSaldo0=[];

  if(menu === "duplikat"){
    const mode = document.querySelector('input[name="duplikatMode"]:checked')?.value || "single";

    if(mode === "single"){
      const vals = getKey(dataA, fieldA);
      dupA = findDuplicates(vals);
    } else {
      if(!dataB) return;
      const valsA = getKey(dataA, fieldA);
      const valsB = getKey(dataB, fieldB);
      dupA = findDuplicates(valsA);
      dupB = findDuplicates(valsB);
    }
  }

  if(menu === "selisih" || menu === "stok"){
    if(!dataB) return;
    const mapA = new Map(dataA.map(item => [item?.[fieldA], item]));
    const mapB = new Map(dataB.map(item => [item?.[fieldB], item]));
    const valsA = getKey(dataA, fieldA);
    const valsB = getKey(dataB, fieldB);

    const setA = new Set(valsA);
    const setB = new Set(valsB);

    onlyInA = [...setA].filter(x => !setB.has(x));
    onlyInB = [...setB].filter(x => !setA.has(x));

    if(menu === "stok"){
      const inBoth = [...setA].filter(x => setB.has(x));
      stok0 = inBoth.filter(x => {
        const sA = Number(mapA.get(x)?.stock_on_hand ?? -1);
        const sB = Number(mapB.get(x)?.stock_akhir ?? -1);
        return sA === 0 && sB === 0;
      });
      stokAdaTapiSaldo0 = inBoth.filter(x => {
        const sA = Number(mapA.get(x)?.stock_on_hand ?? 0);
        const sB = Number(mapB.get(x)?.stock_akhir ?? 0);
        return sA > 0 && sB === 0;
      });
    }
  }

  dataMap[menu].result = { onlyInA, onlyInB, dupA, dupB, stok0, stokAdaTapiSaldo0 };

  const container = document.querySelector(`.tab-content[data-tab="${menu}"] .result-content`);
  let html = "";

  if(menu==="selisih"){
    html += `<div class="result-section">
      <h3>🎉 Ada di Tabel A tapi tidak ada di Tabel B <span class="badge">${onlyInA.length}</span></h3>
      ${renderTable("onlyA", onlyInA)}
    </div>
    <div class="result-section">
      <h3>🎉 Ada di Tabel B tapi tidak ada di Tabel A <span class="badge">${onlyInB.length}</span></h3>
      ${renderTable("onlyB", onlyInB)}
    </div>`;
  }
  else if(menu==="duplikat"){
    html += `<div class="result-section">
      <h3>⚠️ Duplikat di Tabel A <span class="badge">${dupA.length}</span></h3>
      ${renderTable("dupA", dupA)}
    </div>`;
    if(dataB){
      html += `<div class="result-section">
        <h3>⚠️ Duplikat di Tabel B <span class="badge">${dupB.length}</span></h3>
        ${renderTable("dupB", dupB)}
      </div>`;
    }
  }
  else if(menu==="stok"){
    html += `<div class="result-section">
      <h3>⚠️ Stock 0 di kedua tabel <span class="badge">${stok0.length}</span></h3>
      ${renderTable("stok0", stok0)}
    </div>
    <div class="result-section">
      <h3>⚠️ Ada stok di Tabel A tapi saldo 0 di Tabel B <span class="badge">${stokAdaTapiSaldo0.length}</span></h3>
      ${renderTable("stokAdaTapiSaldo0", stokAdaTapiSaldo0)}
    </div>`;
  }

  container.innerHTML = html;
  document.getElementById(`downloadBtn_${menu}`).disabled = false;
}

function downloadCSV(menu){
  const result = dataMap[menu].result;
  if(!result){ 
    alert("Belum ada hasil perbandingan!"); 
    return; 
  }

  const fileAName = dataMap[menu].fileAName || "Tabel A";
  const fileBName = dataMap[menu].fileBName || "Tabel B";
  const fieldA = dataMap[menu].fieldA || "-";
  const fieldB = dataMap[menu].fieldB || "-";

  let csv = "Kategori,Nilai\n";

  function formatVal(x){ return `="${x}"`; }

  const kategoriMap = {
    selisih: {
      onlyInA: `Tidak ada di ${fileBName}`,
      onlyInB: `Tidak ada di ${fileAName}`
    },
    duplikat: {
      dupA: `Duplikat di ${fileAName}`,
      dupB: `Duplikat di ${fileBName}`
    },
    stok: {
      stok0: `Stock 0 di ${fileAName} & ${fileBName}`,
      stokAdaTapiSaldo0: `Ada stok di ${fileAName} tapi saldo 0 di ${fileBName}`
    },
    keuangan: {
      onlyInA: `Tidak ada di ${fileBName} / jumlah 0`,
      onlyInB: `Tidak ada di ${fileAName} / jumlah 0`
    }
  };

  for(const key in result){
    const arr = result[key];
    if(!Array.isArray(arr) || arr.length === 0) continue;

    const kategori = (kategoriMap[menu] && kategoriMap[menu][key]) || key;

    arr.forEach(x => {
      csv += `${kategori},${formatVal(x)}\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hasil_${menu}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function resetMenu(menu){
  dataMap[menu] = { A:null, B:null, result:null, fileAName:"", fileBName:"", fieldA:null, fieldB:null };
  document.getElementById(`fileA_${menu}`).value = "";
  document.getElementById(`fileB_${menu}`).value = "";
  document.getElementById(`fileAName_${menu}`).textContent = "Belum ada file";
  document.getElementById(`fileBName_${menu}`).textContent = "Belum ada file";
  document.querySelector(`.tab-content[data-tab="${menu}"] .result-content`).innerHTML = "";
  document.getElementById(`downloadBtn_${menu}`).disabled = true;
}

// Dark Mode
document.getElementById("darkToggle").addEventListener("click", function(){
  document.body.classList.toggle("dark");
  this.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
});

// SPA Hash Navigation
function showTab(menu){
  document.querySelectorAll(".tab-content").forEach(c => {
    c.style.display="none";
    c.classList.remove("active");
  });

  const target = document.querySelector(`.tab-content[data-tab="${menu}"]`);
  const mainMenu = document.getElementById("mainMenu");
  const headerTitle = document.querySelector("header h1");
  const subtitle = document.getElementById("subtitle");
  const defaultMsg = document.getElementById("defaultMsg");

  if(menu && target){ 
    mainMenu.style.display = "none";
    target.style.display="block"; 
    setTimeout(()=>target.classList.add("active"),10);

    if(menu==="selisih") headerTitle.textContent = "🔍 Mode: Cek Selisih Barang";
    if(menu==="duplikat") headerTitle.textContent = "♻️ Mode: Cek Duplikat Data";
    if(menu==="stok") headerTitle.textContent = "📦 Mode: Cek Stok Barang";
    if(menu==="keuangan") headerTitle.textContent = "📦 Mode: Cek selisih Keuangan";
    subtitle.style.display = "none";
    if(defaultMsg) defaultMsg.style.display = "none";
  } else {
    mainMenu.style.display = "grid";
    headerTitle.textContent = "🔍 Cek Selisih & Duplikat Data JSON";
    subtitle.style.display = "block";
    if(defaultMsg) defaultMsg.style.display = "block";
  }
}

window.addEventListener("hashchange", ()=> showTab(location.hash.replace("#","")));
window.addEventListener("load", ()=> showTab(location.hash.replace("#","")));

// Bind file input, download & reset button
["selisih","duplikat","stok"].forEach(menu=>{
  const fileAInput = document.getElementById(`fileA_${menu}`);
  const fileBInput = document.getElementById(`fileB_${menu}`);
  const fileANameEl = document.getElementById(`fileAName_${menu}`);
  const fileBNameEl = document.getElementById(`fileBName_${menu}`);

  fileAInput.addEventListener("change", e=>{
    const file = e.target.files[0];
    fileANameEl.textContent = file?.name || "Belum ada file";
    if(file) dataMap[menu].fileAName = getShortFileName(file.name);
    readFile(e.target, menu, "A");
  });
  fileBInput.addEventListener("change", e=>{
    const file = e.target.files[0];
    fileBNameEl.textContent = file?.name || "Belum ada file";
    if(file) dataMap[menu].fileBName = getShortFileName(file.name);
    readFile(e.target, menu, "B");
  });

  document.getElementById(`downloadBtn_${menu}`).addEventListener("click", ()=>downloadCSV(menu));
  document.getElementById(`resetBtn_${menu}`).addEventListener("click", ()=>resetMenu(menu));
});

// Tombol kembali
document.querySelectorAll(".backBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    location.hash = "";
    showTab("");
  });
});

// Mode select (duplikat)
document.querySelectorAll('input[name="duplikatMode"]').forEach(r=>{
  r.addEventListener("change", e=>{
    const section = document.querySelector('[data-tab="duplikat"] .upload-section');
    if(e.target.value==="single"){
      section.classList.add("single-mode");
    } else {
      section.classList.remove("single-mode");
    }
    updateResult("duplikat");
  });

  // footer
  // Tombol scroll ke atas
document.getElementById("scrollTopBtn").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== Tambahan Menu Keuangan =====
dataMap.keuangan = { A:null, B:null, result:null, fileAName:"", fileBName:"", fieldA:null, fieldB:null };

// UpdateResult untuk keuangan
const originalUpdateResult = updateResult;
updateResult = function(menu){
  originalUpdateResult(menu);
  if(menu !== "keuangan") return;

  const { A:dataA, B:dataB, fieldA, fieldB } = dataMap[menu];
  if(!dataA || !dataB) return;

  const mapA = new Map(dataA.map(item => [item?.[fieldA], item]));
  const mapB = new Map(dataB.map(item => [item?.[fieldB], item]));

  const valsA = getKey(dataA, fieldA);
  const valsB = getKey(dataB, fieldB);

  const setA = new Set(valsA);
  const setB = new Set(valsB);

  // Cek selisih / nilai 0
  const onlyInA = [...setA].filter(x => !setB.has(x) || Number(mapB.get(x)?.jumlah_in ?? 0) === 0);
  const onlyInB = [...setB].filter(x => !setA.has(x) || Number(mapA.get(x)?.harga_total ?? 0) === 0);

  dataMap[menu].result = { onlyInA, onlyInB };

  const container = document.querySelector(`.tab-content[data-tab="${menu}"] .result-content`);
  container.innerHTML = `
    <div class="result-section">
      <h3>🎉 Ada di tabel A tapi tidak ada / jumlah 0 di tabel B <span class="badge">${onlyInA.length}</span></h3>
      ${renderTable("keuOnlyA", onlyInA)}
    </div>
    <div class="result-section">
      <h3>🎉 Ada di tabel A tapi tidak ada / jumlah 0 di tabel B  <span class="badge">${onlyInB.length}</span></h3>
      ${renderTable("keuOnlyB", onlyInB)}
    </div>
  `;
  document.getElementById(`downloadBtn_${menu}`).disabled = false;
};

// Bind file input, download & reset untuk keuangan
(() => {
  const menu = "keuangan";
  const fileAInput = document.getElementById(`fileA_${menu}`);
  const fileBInput = document.getElementById(`fileB_${menu}`);
  const fileANameEl = document.getElementById(`fileAName_${menu}`);
  const fileBNameEl = document.getElementById(`fileBName_${menu}`);

  fileAInput?.addEventListener("change", e=>{
    const file = e.target.files[0];
    fileANameEl.textContent = file?.name || "Belum ada file";
    if(file) dataMap[menu].fileAName = getShortFileName(file.name);
    readFile(e.target, menu, "A");
  });
  fileBInput?.addEventListener("change", e=>{
    const file = e.target.files[0];
    fileBNameEl.textContent = file?.name || "Belum ada file";
    if(file) dataMap[menu].fileBName = getShortFileName(file.name);
    readFile(e.target, menu, "B");
  });

  document.getElementById(`downloadBtn_${menu}`)?.addEventListener("click", ()=>downloadCSV(menu));
  document.getElementById(`resetBtn_${menu}`)?.addEventListener("click", ()=>resetMenu(menu));
})();


});
