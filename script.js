
const STORAGE_KEY = "clipboardButtonsWebDataV1";
const DEFAULT_DATA = {
  settings: { backgroundColor: "#ffffff" },
  categories: {
    General: {
      color: "#d9eaf7",
      textColor: "#000000",
      buttons: [{ label: "Example", text: "This is copied text.", color: "#f0f0f0", textColor: "#000000" }]
    }
  }
};

let data = loadData();
let currentCategory = firstCategory();
let editingButton = null;
let editingCategory = null;
let draggedButton = null;
let draggedCategory = null;

const $ = id => document.getElementById(id);
const elements = {
  addButtonBtn: $("addButtonBtn"), addCategoryBtn: $("addCategoryBtn"), editCategoryBtn: $("editCategoryBtn"),
  deleteCategoryBtn: $("deleteCategoryBtn"), backgroundColorBtn: $("backgroundColorBtn"), exportBtn: $("exportBtn"),
  importBtn: $("importBtn"), importFileInput: $("importFileInput"), searchInput: $("searchInput"),
  status: $("status"), tabBar: $("tabBar"), buttonGrid: $("buttonGrid"), previewBox: $("previewBox"),
  buttonDialog: $("buttonDialog"), buttonForm: $("buttonForm"), buttonDialogTitle: $("buttonDialogTitle"),
  buttonLabelInput: $("buttonLabelInput"), buttonColorInput: $("buttonColorInput"), buttonColorTextInput: $("buttonColorTextInput"),
  buttonTextColorInput: $("buttonTextColorInput"), buttonTextColorTextInput: $("buttonTextColorTextInput"),
  buttonCopyTextInput: $("buttonCopyTextInput"), cancelButtonDialogBtn: $("cancelButtonDialogBtn"),
  categoryDialog: $("categoryDialog"), categoryForm: $("categoryForm"), categoryDialogTitle: $("categoryDialogTitle"),
  categoryNameInput: $("categoryNameInput"), categoryColorInput: $("categoryColorInput"), categoryColorTextInput: $("categoryColorTextInput"),
  categoryTextColorInput: $("categoryTextColorInput"), categoryTextColorTextInput: $("categoryTextColorTextInput"),
  cancelCategoryDialogBtn: $("cancelCategoryDialogBtn")
};

function deepClone(v){ return JSON.parse(JSON.stringify(v)); }
function normalizeColor(v,f){ return typeof v==="string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : f; }
function normalizeButton(b){ return { label:b?.label||"Untitled", text:b?.text||"", color:normalizeColor(b?.color,"#f0f0f0"), textColor:normalizeColor(b?.textColor||b?.text_color,"#000000") }; }

function normalizeData(raw){
  const normalized = { settings:{ backgroundColor: normalizeColor(raw?.settings?.backgroundColor || raw?.settings?.background_color, "#ffffff") }, categories:{} };
  const rawCategories = raw?.categories || raw || {};
  if(Array.isArray(rawCategories)){
    normalized.categories.General = { color:"#d9eaf7", textColor:"#000000", buttons:rawCategories.map(normalizeButton) };
    return normalized;
  }
  for(const [name,value] of Object.entries(rawCategories)){
    if(Array.isArray(value)) normalized.categories[name] = { color:"#d9eaf7", textColor:"#000000", buttons:value.map(normalizeButton) };
    else if(value && typeof value==="object") normalized.categories[name] = {
      color:normalizeColor(value.color,"#d9eaf7"),
      textColor:normalizeColor(value.textColor||value.text_color,"#000000"),
      buttons:Array.isArray(value.buttons) ? value.buttons.map(normalizeButton) : []
    };
  }
  return Object.keys(normalized.categories).length ? normalized : deepClone(DEFAULT_DATA);
}

function loadData(){ try{ const s=localStorage.getItem(STORAGE_KEY); return s ? normalizeData(JSON.parse(s)) : deepClone(DEFAULT_DATA); } catch { return deepClone(DEFAULT_DATA); } }
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function firstCategory(){ return Object.keys(data.categories)[0] || null; }
function getSearchText(){ return elements.searchInput.value.trim().toLowerCase(); }
function categoryMatchesSearch(name){ const s=getSearchText(); if(!s) return true; return data.categories[name].buttons.some(b => b.label.toLowerCase().includes(s) || b.text.toLowerCase().includes(s)); }
function visibleCategories(){ return Object.keys(data.categories).filter(categoryMatchesSearch); }
function filteredButtons(name){ const s=getSearchText(); return (data.categories[name]?.buttons || []).map((button,index)=>({button,index})).filter(({button}) => !s || button.label.toLowerCase().includes(s) || button.text.toLowerCase().includes(s)); }
function setStatus(m,t=2500){ elements.status.textContent=m; clearTimeout(setStatus.id); if(t) setStatus.id=setTimeout(()=>elements.status.textContent="",t); }
function applyBackground(){ document.documentElement.style.setProperty("--background", data.settings.backgroundColor || "#ffffff"); }

function render(){
  applyBackground();
  const visible=visibleCategories();
  if(!currentCategory || !visible.includes(currentCategory)) currentCategory = visible[0] || null;
  renderTabs(visible);
  renderButtons();
}

function renderTabs(visible){
  elements.tabBar.innerHTML="";
  if(!visible.length){ elements.tabBar.textContent="No matching tabs"; return; }
  for(const name of visible){
    const cat=data.categories[name];
    const tab=document.createElement("div");
    tab.className="tab" + (name===currentCategory ? " selected" : "");
    tab.textContent=name; tab.style.backgroundColor=cat.color; tab.style.color=cat.textColor;
    tab.draggable=true; tab.dataset.category=name;
    tab.addEventListener("click",()=>{ currentCategory=name; render(); });
    tab.addEventListener("dragstart",e=>{ draggedCategory=name; draggedButton=null; e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",name); });
    tab.addEventListener("dragover",e=>{ if(!draggedCategory && !draggedButton) return; e.preventDefault(); if(draggedButton){ currentCategory=name; render(); }});
    tab.addEventListener("drop",e=>{ e.preventDefault(); if(draggedCategory){ moveCategory(draggedCategory,getCategoryInsertIndex(e.clientX)); draggedCategory=null; }});
    elements.tabBar.appendChild(tab);
  }
}

function renderButtons(){
  elements.buttonGrid.innerHTML="";
  if(!currentCategory){ elements.buttonGrid.textContent="No matching buttons"; return; }
  for(const {button,index} of filteredButtons(currentCategory)){
    const tile=document.createElement("article");
    tile.className="tile"; tile.draggable=true; tile.dataset.index=String(index);
    const handle=document.createElement("div"); handle.className="drag-handle"; handle.textContent="☰ Drag";
    const copy=document.createElement("button"); copy.className="copy-button"; copy.textContent=button.label; copy.style.backgroundColor=button.color; copy.style.color=button.textColor;
    copy.addEventListener("click",()=>copyText(button));
    copy.addEventListener("mouseenter",e=>showPreview(e,button)); copy.addEventListener("mousemove",movePreview); copy.addEventListener("mouseleave",hidePreview);
    const controls=document.createElement("div"); controls.className="tile-controls";
    const edit=document.createElement("button"); edit.textContent="Edit"; edit.addEventListener("click",()=>openButtonDialog(currentCategory,index));
    const dup=document.createElement("button"); dup.textContent="Duplicate"; dup.addEventListener("click",()=>duplicateButton(currentCategory,index));
    const del=document.createElement("button"); del.textContent="Delete"; del.addEventListener("click",()=>deleteButton(currentCategory,index));
    controls.append(edit,dup,del); tile.append(handle,copy,controls);
    tile.addEventListener("dragstart",e=>{ draggedButton={categoryName:currentCategory,index}; draggedCategory=null; tile.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; });
    tile.addEventListener("dragend",()=>{ tile.classList.remove("dragging"); draggedButton=null; clearDropMarkers(); });
    tile.addEventListener("dragover",e=>{ if(!draggedButton) return; e.preventDefault(); clearDropMarkers(); tile.classList.add("drop-marker"); });
    tile.addEventListener("dragleave",()=>tile.classList.remove("drop-marker"));
    tile.addEventListener("drop",e=>{ e.preventDefault(); clearDropMarkers(); if(draggedButton){ moveButton(draggedButton.categoryName, draggedButton.index, currentCategory, getButtonInsertIndex(e.clientX,e.clientY)); draggedButton=null; }});
    elements.buttonGrid.appendChild(tile);
  }
  elements.buttonGrid.ondragover=e=>{ if(draggedButton) e.preventDefault(); };
  elements.buttonGrid.ondrop=e=>{ if(!draggedButton) return; e.preventDefault(); moveButton(draggedButton.categoryName,draggedButton.index,currentCategory,getButtonInsertIndex(e.clientX,e.clientY)); draggedButton=null; };
}

function clearDropMarkers(){ document.querySelectorAll(".drop-marker").forEach(e=>e.classList.remove("drop-marker")); }
async function copyText(button){ try{ await navigator.clipboard.writeText(button.text); } catch { fallbackCopy(button.text); } setStatus(`Copied: ${button.label}`); }
function fallbackCopy(text){ const t=document.createElement("textarea"); t.value=text; t.style.position="fixed"; t.style.left="-9999px"; document.body.appendChild(t); t.focus(); t.select(); document.execCommand("copy"); t.remove(); }
function showPreview(e,b){ elements.previewBox.innerHTML=`<div class="preview-title"></div><div></div>`; elements.previewBox.children[0].textContent=b.label; elements.previewBox.children[1].textContent=b.text.trim()?b.text:"(empty)"; elements.previewBox.hidden=false; movePreview(e); }
function movePreview(e){ if(elements.previewBox.hidden) return; const x=Math.min(e.clientX+18, Math.max(10, window.innerWidth-elements.previewBox.offsetWidth-10)); const y=Math.min(e.clientY+18, Math.max(10, window.innerHeight-elements.previewBox.offsetHeight-10)); elements.previewBox.style.left=`${x}px`; elements.previewBox.style.top=`${y}px`; }
function hidePreview(){ elements.previewBox.hidden=true; }

function getButtonInsertIndex(x,y){
  const tiles=[...elements.buttonGrid.querySelectorAll(".tile")];
  if(!tiles.length) return data.categories[currentCategory].buttons.length;
  const infos=tiles.map(tile=>{ const r=tile.getBoundingClientRect(); return { index:Number(tile.dataset.index), centerX:r.left+r.width/2, centerY:r.top+r.height/2, height:r.height }; });
  const rows=[];
  for(const info of infos.sort((a,b)=>a.centerY-b.centerY)){
    let row=rows.find(r=>Math.abs(r.centerY-info.centerY)<=info.height*.6);
    if(!row){ row={centerY:info.centerY, tiles:[]}; rows.push(row); }
    row.tiles.push(info); row.centerY=row.tiles.reduce((s,t)=>s+t.centerY,0)/row.tiles.length;
  }
  rows.sort((a,b)=>a.centerY-b.centerY);
  const selected=rows.reduce((best,row)=>Math.abs(row.centerY-y)<Math.abs(best.centerY-y)?row:best,rows[0]);
  let base=0; for(const row of rows){ if(row===selected) break; base+=row.tiles.length; }
  selected.tiles.sort((a,b)=>a.centerX-b.centerX);
  let slot=0; for(const tile of selected.tiles){ if(x>tile.centerX) slot++; else break; }
  const filtered=filteredButtons(currentCategory);
  const visibleSlot=base+slot;
  return visibleSlot>=filtered.length ? data.categories[currentCategory].buttons.length : filtered[visibleSlot].index;
}

function moveButton(sourceCategory,sourceIndex,targetCategory,insertIndex){
  const source=data.categories[sourceCategory]?.buttons, target=data.categories[targetCategory]?.buttons;
  if(!source||!target||sourceIndex<0||sourceIndex>=source.length) return;
  const [button]=source.splice(sourceIndex,1);
  if(sourceCategory===targetCategory && sourceIndex<insertIndex) insertIndex--;
  insertIndex=Math.max(0,Math.min(insertIndex,target.length));
  target.splice(insertIndex,0,button); currentCategory=targetCategory; saveData(); render(); setStatus("Button moved.");
}

function getCategoryInsertIndex(x){
  const tabs=[...elements.tabBar.querySelectorAll(".tab")], all=Object.keys(data.categories);
  if(!tabs.length) return all.length;
  let slot=tabs.length;
  for(let i=0;i<tabs.length;i++){ const r=tabs[i].getBoundingClientRect(); if(x<r.left+r.width/2){ slot=i; break; } }
  if(slot>=tabs.length){ return all.indexOf(tabs[tabs.length-1].dataset.category)+1; }
  return all.indexOf(tabs[slot].dataset.category);
}
function moveCategory(name,insertIndex){
  const entries=Object.entries(data.categories); const old=entries.findIndex(([k])=>k===name); if(old<0) return;
  const [entry]=entries.splice(old,1); if(old<insertIndex) insertIndex--; insertIndex=Math.max(0,Math.min(insertIndex,entries.length));
  entries.splice(insertIndex,0,entry); data.categories=Object.fromEntries(entries); currentCategory=name; saveData(); render(); setStatus("Category moved.");
}

function openButtonDialog(categoryName,buttonIndex=null){
  editingButton={categoryName,buttonIndex};
  const isEdit=buttonIndex!==null, b=isEdit?data.categories[categoryName].buttons[buttonIndex]:{label:"",text:"",color:"#f0f0f0",textColor:"#000000"};
  elements.buttonDialogTitle.textContent=isEdit?"Edit Button":"Add Button";
  elements.buttonLabelInput.value=b.label; setSyncedColor(elements.buttonColorInput,elements.buttonColorTextInput,b.color); setSyncedColor(elements.buttonTextColorInput,elements.buttonTextColorTextInput,b.textColor); elements.buttonCopyTextInput.value=b.text; elements.buttonDialog.showModal();
}
function saveButtonDialog(e){
  e.preventDefault(); const label=elements.buttonLabelInput.value.trim(); if(!label) return;
  const button={label,text:elements.buttonCopyTextInput.value,color:normalizeColor(elements.buttonColorTextInput.value,"#f0f0f0"),textColor:normalizeColor(elements.buttonTextColorTextInput.value,"#000000")};
  const {categoryName,buttonIndex}=editingButton; if(buttonIndex===null) data.categories[categoryName].buttons.push(button); else data.categories[categoryName].buttons[buttonIndex]=button;
  saveData(); elements.buttonDialog.close(); render();
}
function duplicateButton(categoryName,index){ const s=data.categories[categoryName].buttons[index]; data.categories[categoryName].buttons.splice(index+1,0,{...deepClone(s),label:`${s.label} Copy`}); saveData(); render(); setStatus("Button duplicated."); }
function deleteButton(categoryName,index){ const b=data.categories[categoryName].buttons[index]; if(!confirm(`Delete button "${b.label}"?`)) return; data.categories[categoryName].buttons.splice(index,1); saveData(); render(); }

function openCategoryDialog(categoryName=null){
  editingCategory=categoryName; const isEdit=categoryName!==null, c=isEdit?data.categories[categoryName]:{color:"#d9eaf7",textColor:"#000000"};
  elements.categoryDialogTitle.textContent=isEdit?"Edit Category":"Add Category"; elements.categoryNameInput.value=categoryName||""; setSyncedColor(elements.categoryColorInput,elements.categoryColorTextInput,c.color); setSyncedColor(elements.categoryTextColorInput,elements.categoryTextColorTextInput,c.textColor); elements.categoryDialog.showModal();
}
function saveCategoryDialog(e){
  e.preventDefault(); const name=elements.categoryNameInput.value.trim(); if(!name) return;
  if(name in data.categories && name!==editingCategory){ alert("That category already exists."); return; }
  const categoryData={color:normalizeColor(elements.categoryColorTextInput.value,"#d9eaf7"),textColor:normalizeColor(elements.categoryTextColorTextInput.value,"#000000"),buttons:editingCategory?data.categories[editingCategory].buttons:[]};
  const newCats={}; if(editingCategory){ for(const [key,val] of Object.entries(data.categories)) newCats[key===editingCategory?name:key]=key===editingCategory?categoryData:val; } else { Object.assign(newCats,data.categories); newCats[name]=categoryData; }
  data.categories=newCats; currentCategory=name; saveData(); elements.categoryDialog.close(); render();
}
function deleteCurrentCategory(){ if(!currentCategory) return; if(Object.keys(data.categories).length===1){ alert("You must keep at least one category."); return; } if(!confirm(`Delete category "${currentCategory}" and all buttons inside it?`)) return; delete data.categories[currentCategory]; currentCategory=firstCategory(); saveData(); render(); }
function chooseBackgroundColor(){ const input=document.createElement("input"); input.type="color"; input.value=data.settings.backgroundColor||"#ffffff"; input.addEventListener("input",()=>{ data.settings.backgroundColor=input.value; saveData(); render(); }); input.click(); }
function exportBackup(){ const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="clipboard-buttons-backup.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importBackupFile(file){ const reader=new FileReader(); reader.onload=()=>{ try{ const imported=normalizeData(JSON.parse(reader.result)); if(!confirm("This will replace your current buttons. Continue?")) return; localStorage.setItem(`${STORAGE_KEY}.beforeImportBackup`,JSON.stringify(data)); data=imported; currentCategory=firstCategory(); saveData(); render(); setStatus("Backup imported. A safety copy was saved in browser storage."); }catch{ alert("That file could not be imported."); } }; reader.readAsText(file); }
function setSyncedColor(colorInput,textInput,value){ const c=normalizeColor(value,"#000000"); colorInput.value=c; textInput.value=c; }
function syncColorInputs(colorInput,textInput){ colorInput.addEventListener("input",()=>textInput.value=colorInput.value); textInput.addEventListener("input",()=>{ const c=normalizeColor(textInput.value,null); if(c) colorInput.value=c; }); }

elements.addButtonBtn.addEventListener("click",()=>{ if(currentCategory) openButtonDialog(currentCategory); });
elements.addCategoryBtn.addEventListener("click",()=>openCategoryDialog());
elements.editCategoryBtn.addEventListener("click",()=>{ if(currentCategory) openCategoryDialog(currentCategory); });
elements.deleteCategoryBtn.addEventListener("click",deleteCurrentCategory);
elements.backgroundColorBtn.addEventListener("click",chooseBackgroundColor);
elements.exportBtn.addEventListener("click",exportBackup);
elements.importBtn.addEventListener("click",()=>elements.importFileInput.click());
elements.importFileInput.addEventListener("change",()=>{ const file=elements.importFileInput.files[0]; if(file) importBackupFile(file); elements.importFileInput.value=""; });
elements.searchInput.addEventListener("input",render);
elements.buttonForm.addEventListener("submit",saveButtonDialog);
elements.cancelButtonDialogBtn.addEventListener("click",()=>elements.buttonDialog.close());
elements.categoryForm.addEventListener("submit",saveCategoryDialog);
elements.cancelCategoryDialogBtn.addEventListener("click",()=>elements.categoryDialog.close());
syncColorInputs(elements.buttonColorInput,elements.buttonColorTextInput);
syncColorInputs(elements.buttonTextColorInput,elements.buttonTextColorTextInput);
syncColorInputs(elements.categoryColorInput,elements.categoryColorTextInput);
syncColorInputs(elements.categoryTextColorInput,elements.categoryTextColorTextInput);
render();
