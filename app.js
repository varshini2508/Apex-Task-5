/* ---------- Utilities ---------- */
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = () => Date.now() + Math.random().toString(16).slice(2);

const store = {
  read(){ try { return JSON.parse(localStorage.getItem("tasks")||"[]"); } catch { return []; } },
  write(data){ localStorage.setItem("tasks", JSON.stringify(data)); }
};

/* ---------- State ---------- */
let tasks = store.read();
let filter = "all";
let query = "";
let sortBy = "created_desc";

/* ---------- Elements ---------- */
const form = $("#task-form");
const listEl = $("#taskList");
const emptyEl = $("#empty");
const statsEl = $("#stats");
const chips = $$(".chip");
const search = $("#search");
const sortSel = $("#sort");
const clearCompletedBtn = $("#clearCompleted");
const exportBtn = $("#export");
const importInput = $("#import");
const yearEl = $("#year");
yearEl.textContent = new Date().getFullYear();

/* ---------- Nav toggle (mobile) ---------- */
$(".nav-toggle").addEventListener("click", () => {
  const links = $(".nav-links");
  const isOpen = getComputedStyle(links).display !== "none";
  links.style.display = isOpen ? "none" : "flex";
});

/* ---------- Appear on scroll ---------- */
const io = new IntersectionObserver((entries, obs)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("show"); obs.unobserve(e.target); } });
},{ threshold:.2 });
$$(".fade").forEach(el=>io.observe(el));

/* ---------- Render ---------- */
function render(){
  const filtered = tasks
    .filter(t => {
      if(query && !(t.title+ " " + (t.notes||"")).toLowerCase().includes(query)) return false;
      if(filter==="active") return !t.completed;
      if(filter==="completed") return t.completed;
      if(filter==="high") return t.priority==="high";
      return true;
    })
    .sort((a,b)=>{
      switch (sortBy){
        case "created_asc": return a.created - b.created;
        case "created_desc": return b.created - a.created;
        case "due_asc": return (a.due||"") > (b.due||"") ? 1 : -1;
        case "due_desc": return (a.due||"") < (b.due||"") ? 1 : -1;
        case "priority_desc":
          const rank = {high:3, medium:2, low:1};
          return rank[b.priority]-rank[a.priority];
        default: return 0;
      }
    });

  listEl.innerHTML = "";
  filtered.forEach(t => listEl.appendChild(taskItem(t)));
  emptyEl.style.display = filtered.length ? "none" : "block";

  const total = tasks.length;
  const done = tasks.filter(t=>t.completed).length;
  statsEl.textContent = `Total: ${total} • Active: ${total-done} • Completed: ${done}`;
  store.write(tasks);
}

function taskItem(t){
  const li = document.createElement("li");
  li.className = "task" + (t.completed ? " completed":"");
  li.dataset.id = t.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = t.completed;
  checkbox.ariaLabel = "Mark completed";
  checkbox.addEventListener("change", ()=>{
    t.completed = checkbox.checked;
    render();
  });

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="task__title">${escapeHTML(t.title)}</div>
    <small>${t.due ? "Due: "+t.due+" • " : ""}Priority: <span class="badge ${t.priority}">${t.priority}</span>${t.notes? " • " + escapeHTML(t.notes):""}</small>
  `;

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `
    <button class="icon-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
    <button class="icon-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
  `;

  // Edit
  controls.children[0].addEventListener("click", ()=> editTask(t));
  // Delete
  controls.children[1].addEventListener("click", ()=>{
    if(confirm("Delete this task?")){ tasks = tasks.filter(x=>x.id!==t.id); render(); }
  });

  li.append(checkbox, body, controls);
  return li;
}

function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Handlers ---------- */
form.addEventListener("submit", e=>{
  e.preventDefault();
  const title = $("#title").value.trim();
  if(!title) return;
  const task = {
    id: uid(),
    title,
    due: $("#due").value || "",
    priority: $("#priority").value,
    notes: $("#notes").value.trim(),
    completed: false,
    created: Date.now()
  };
  tasks.unshift(task);
  form.reset();
  $("#title").focus();
  render();
});

function editTask(t){
  const title = prompt("Edit title:", t.title);
  if(title===null) return;
  t.title = title.trim() || t.title;
  const notes = prompt("Edit notes:", t.notes||"");
  if(notes!==null) t.notes = notes.trim();
  render();
}

chips.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    chips.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    render();
  });
});

let searchTimer;
search.addEventListener("input", ()=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{
    query = search.value.trim().toLowerCase();
    render();
  }, 180); // debounced for perf
});

sortSel.addEventListener("change", ()=>{
  sortBy = sortSel.value;
  render();
});

clearCompletedBtn.addEventListener("click", ()=>{
  if(confirm("Clear all completed tasks?")){
    tasks = tasks.filter(t=>!t.completed);
    render();
  }
});

/* ---------- Import/Export ---------- */
exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(tasks,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tasks.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

importInput.addEventListener("change", async ()=>{
  const file = importInput.files[0]; if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(Array.isArray(data)){ tasks = data; render(); }
    else alert("Invalid file.");
  }catch{ alert("Invalid JSON file."); }
  importInput.value = "";
});

/* ---------- Init with sample (first time only) ---------- */
if(!tasks.length){
  tasks = [
    { id:uid(), title:"Build full web application", due:"", priority:"high", notes:"Capstone project using HTML, CSS, JS", completed:false, created:Date.now()-300000 },
    { id:uid(), title:"Optimize performance", due:"", priority:"medium", notes:"Minify, lazy-load images, reduce requests", completed:false, created:Date.now()-200000 },
    { id:uid(), title:"Cross-browser & mobile testing", due:"", priority:"low", notes:"Chrome, Firefox, Safari + mobiles", completed:false, created:Date.now()-100000 },
  ];
}
render();
