// ============================================================
//  CNHS SHS ENROLLMENT PORTAL — script.js
//  Firebase Firestore + Auth (Anonymous)
//  Handles: Multi-step form, validation, submission,
//           countdown timer, enrollment status check
// ============================================================

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// ============================================================
//  FIREBASE CONFIG  ← your project credentials
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyAJZ1dibYjK9_SWVrdPl4NWiHPXNS1bz5Y",
  authDomain:        "cnhs-student-files.firebaseapp.com",
  projectId:         "cnhs-student-files",
  storageBucket:     "cnhs-student-files.appspot.com",
  messagingSenderId: "1065212176778",
  appId:             "1:1065212176778:web:45746a21168cea1e1a0073"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// Sign in anonymously so Firestore security rules allow writes
signInAnonymously(auth).catch(e => console.warn("Auth error:", e.message));


// ============================================================
//  ELECTIVE DATA
// ============================================================
const ACADEMIC_ELECTIVES = [
  "Arts, Social Sciences & Humanities",
  "Business & Entrepreneurship",
  "Science, Technology, Engineering & Mathematics (STEM)",
  "Sports, Health & Wellness",
  "Field Experience"
];

const TECHPRO_ELECTIVES = [
  "Aesthetic, Wellness & Human Care",
  "Agri-Fishery Business & Food Innovation",
  "Artisanry & Creative Enterprise",
  "Automotive & Small Engine Technologies",
  "Construction & Building Technologies",
  "Creative Arts & Design Technologies",
  "Hospitality & Tourism",
  "ICT Support & Computer Programming Technologies",
  "Industrial Technologies",
  "Maritime Transport"
];

// Selected elective sets (indices)
let acSelection = new Set();
let tpSelection = new Set();
let selectedStype = null;


// ============================================================
//  UTILITY HELPERS
// ============================================================

/** Get trimmed value from an input/select by ID */
function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}

/** Set value on element by ID */
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

/** Show element (remove s2-hidden / display:none) */
function show(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("s2-hidden");
    el.style.display = "";
  }
}

/** Hide element */
function hide(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("s2-hidden");
  }
}

/** Generate a unique reference number */
function generateRefNumber() {
  const year   = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `CNHS-${year}-${random}`;
}

/** Copy text to clipboard */
window.copyCred = function (id, btn) {
  const text = document.getElementById(id)?.textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ Copied";
    btn.style.background   = "rgba(34,197,94,0.12)";
    btn.style.borderColor  = "rgba(34,197,94,0.3)";
    btn.style.color        = "#16a34a";
    setTimeout(() => {
      btn.textContent        = orig;
      btn.style.background   = "";
      btn.style.borderColor  = "";
      btn.style.color        = "";
    }, 1800);
  });
};


// ============================================================
//  ENROLLMENT STATUS + COUNTDOWN
// ============================================================

let countdownInterval = null;

async function checkEnrollmentStatus() {
  try {
    const snap = await getDoc(doc(db, "settings", "testMode"));
    if (!snap.exists()) return; // No settings doc → just show the form

    const data = snap.data();

    // If explicitly disabled, lock the form
    if (data.active === false) {
      showClosedScreen();
      return;
    }

    // Parse endDate (Firestore Timestamp or ISO string)
    let endDate = null;
    if (data.endDate?.toDate) {
      endDate = data.endDate.toDate();
    } else if (data.endDate) {
      endDate = new Date(data.endDate);
    }

    if (endDate) {
      if (endDate <= new Date()) {
        showClosedScreen();
        return;
      }
      startCountdown(endDate);
    }
  } catch (e) {
    console.warn("Could not fetch enrollment status:", e.message);
    // Fail silently — form remains visible
  }
}

function showClosedScreen() {
  // Hide all form steps
  document.querySelectorAll(".form-step").forEach(s => s.classList.remove("active"));

  // Hide progress bar
  const pw = document.getElementById("progressWrap");
  if (pw) pw.style.display = "none";

  // Show the closed screen
  const closed = document.getElementById("closedScreen");
  if (closed) closed.classList.add("active");

  // Update the countdown strip UI
  const strip = document.getElementById("enrollmentCountdownStrip");
  if (strip) {
    strip.style.background   = "rgba(220,38,38,0.2)";
    strip.style.borderColor  = "rgba(220,38,38,0.5)";
    const lbl = strip.querySelector(".cd-label");
    if (lbl) lbl.textContent = "🔴 Enrollment Closed";
    ["D", "H", "M", "S"].forEach(u => {
      const el = document.getElementById("fcd-" + u);
      if (el) el.textContent = "00";
    });
  }
}

function startCountdown(endDate) {
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdown(endDate);
  countdownInterval = setInterval(() => tickCountdown(endDate), 1000);
}

function tickCountdown(endDate) {
  const diff = endDate - new Date();
  if (diff <= 0) {
    clearInterval(countdownInterval);
    showClosedScreen();
    return;
  }

  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const secs  = Math.floor((diff % 60000) / 1000);

  const pad = n => String(n).padStart(2, "0");
  const setUnit = (id, v) => {
    const el = document.getElementById("fcd-" + id);
    if (el) el.textContent = pad(v);
  };

  setUnit("D", days);
  setUnit("H", hours);
  setUnit("M", mins);
  setUnit("S", secs);

  // Turn the strip red when under 24 hours
  const strip = document.getElementById("enrollmentCountdownStrip");
  if (strip && diff < 86400000) {
    strip.style.background  = "rgba(220,38,38,0.2)";
    strip.style.borderColor = "rgba(220,38,38,0.45)";
  }
}


// ============================================================
//  MULTI-STEP NAVIGATION
// ============================================================

let currentStep = 0;
const formSteps = document.querySelectorAll(".form-step");
const progressBar  = document.getElementById("progressBar");
const stepLabels   = [0, 1, 2, 3].map(i => document.getElementById("ps" + i));

function goToStep(n) {
  formSteps.forEach((s, i) => s.classList.toggle("active", i === n));
  currentStep = n;

  // Update progress bar width
  progressBar.style.width = (((n + 1) / formSteps.length) * 100) + "%";

  // Update step label highlights
  stepLabels.forEach((el, i) => {
    if (el) el.classList.toggle("active", i <= n);
  });

  // Populate review on last step
  if (n === 3) populateReview();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Validate required fields in the current step section */
function validateStep(stepIndex) {
  if (stepIndex === 0) return true; // Welcome step — no fields

  const stepEl = formSteps[stepIndex];
  let valid = true;

  stepEl.querySelectorAll("input[required], select[required]").forEach(el => {
    if (!el.value.trim()) {
      el.classList.add("error");
      valid = false;
    } else {
      el.classList.remove("error");
    }
    el.addEventListener("input", () => el.classList.remove("error"), { once: true });
  });

  if (!valid) alert("⚠️ Please fill in all required fields before proceeding.");

  // Extra Step 2 validation (strand + student type)
  if (stepIndex === 2 && valid) {
    if (typeof window.__step2Validate === "function") {
      return window.__step2Validate();
    }
  }

  return valid;
}

// Button listeners
document.getElementById("startBtn")?.addEventListener("click",  () => goToStep(1));
document.getElementById("back1")?.addEventListener("click",     () => goToStep(0));
document.getElementById("next1")?.addEventListener("click",     () => { if (validateStep(1)) goToStep(2); });
document.getElementById("back2")?.addEventListener("click",     () => goToStep(1));
document.getElementById("next2")?.addEventListener("click",     () => { if (validateStep(2)) goToStep(3); });
document.getElementById("back3")?.addEventListener("click",     () => goToStep(2));
document.getElementById("submitBtn")?.addEventListener("click", submitRegistration);
document.getElementById("registerAnother")?.addEventListener("click", () => location.reload());


// ============================================================
//  INPUT MASKS
// ============================================================

// LRN — digits only, max 12
document.getElementById("lrn")?.addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12);
});

// ZIP — digits only, max 4
document.getElementById("zipCode")?.addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

// Age — clamp 14-25
document.getElementById("age")?.addEventListener("change", e => {
  let v = parseInt(e.target.value, 10);
  if (isNaN(v)) return;
  if (v < 14) v = 14;
  if (v > 25) v = 25;
  e.target.value = v;
});


// ============================================================
//  STEP 2 — ACADEMIC INFORMATION LOGIC
// ============================================================

const STYPES_G11 = [
  { value: "New Student",  label: "New Student — Incoming Grade 11" },
  { value: "Transferee",   label: "Transferee — From another school" },
  { value: "Balik-Aral",   label: "Balik-Aral — Returning student" }
];

const STYPES_G12 = [
  { value: "Continuing",   label: "Continuing — Promoted from Grade 11" },
  { value: "Transferee",   label: "Transferee — From another school" },
  { value: "Balik-Aral",   label: "Balik-Aral — Returning student" }
];

function resetStep2(level) {
  if (level <= 1) {
    setVal("trackSelect",  "");
    setVal("strandSelect", "");
    setVal("strand",       "");
    hide("s2-track-block");
    hide("s2-track-row");
    hide("s2-strand-row");
    hide("s2-electives-block");
    acSelection.clear();
    tpSelection.clear();
  }
  if (level <= 2) {
    setVal("studentType", "");
    selectedStype = null;
    hide("s2-stype-block");
    const pw = document.getElementById("s2-prev-school-wrap");
    if (pw) pw.style.display = "none";
    setVal("prevSchool", "");
    // Deselect all stype cards
    document.querySelectorAll(".stype-card").forEach(c => {
      c.classList.remove("selected");
      const chk = c.querySelector(".stype-check");
      if (chk) chk.textContent = "";
    });
  }
  if (level <= 3) {
    hide("s2-reason-block");
  }
}

function populateStudentTypes(types) {
  const sel = document.getElementById("studentType");
  if (!sel) return;
  sel.innerHTML =
    `<option value="">— Select Classification —</option>` +
    types.map(t => `<option value="${t.value}">${t.label}</option>`).join("");
}

/** Build elective tab+scroll UI inside #s2-electives-block */
function buildElectiveTabs(activeTrack) {
  const block = document.getElementById("s2-electives-block");
  if (!block) return;
  block.innerHTML = ""; // clear previous

  /* ── Section label ── */
  const label = document.createElement("p");
  label.className = "s2-label";
  label.textContent = "Elective Clusters";
  block.appendChild(label);

  /* ── Tab bar ── */
  const tabBar = document.createElement("div");
  tabBar.className = "elective-tab-bar";
  tabBar.style.cssText =
    "display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:0;";

  const panels = {};

  const TABS = [
    { key: "academic", label: "Academic",          items: ACADEMIC_ELECTIVES, selSet: acSelection,  color: "#3b82f6" },
    { key: "techpro",  label: "Tech-Vocational",   items: TECHPRO_ELECTIVES,  selSet: tpSelection,  color: "#10b981" },
  ];

  /* ── Panel wrapper (scrollable) ── */
  const panelWrap = document.createElement("div");
  panelWrap.style.cssText =
    "position:relative;overflow:hidden;border:1px solid #e2e8f0;" +
    "border-top:none;border-radius:0 0 10px 10px;background:#fff;";

  TABS.forEach((tab, idx) => {
    /* Tab button */
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.tabKey = tab.key;
    btn.textContent = tab.label;
    btn.style.cssText =
      `flex:1;padding:10px 6px;font-size:.85rem;font-weight:600;border:none;` +
      `cursor:pointer;background:#f8fafc;color:#64748b;transition:all .2s;` +
      `border-bottom:3px solid transparent;`;
    tabBar.appendChild(btn);

    /* Count badge inside tab */
    const badge = document.createElement("span");
    badge.id = `${tab.key}-tab-badge`;
    badge.style.cssText =
      "display:inline-block;margin-left:6px;background:#e2e8f0;" +
      "color:#475569;font-size:.72rem;padding:1px 7px;border-radius:999px;";
    badge.textContent = "0";
    btn.appendChild(badge);

    /* Scrollable chip panel */
    const panel = document.createElement("div");
    panel.id = `elective-panel-${tab.key}`;
    panel.style.cssText =
      "display:none;max-height:260px;overflow-y:auto;padding:14px 12px;" +
      "scroll-behavior:smooth;";
    panels[tab.key] = panel;
    panelWrap.appendChild(panel);

    /* Build chips into panel */
    tab.items.forEach((chipLabel, i) => {
      const chip = document.createElement("div");
      chip.className = `elective-chip ${tab.key}`;
      chip.dataset.idx = i;
      chip.style.cssText =
        "display:flex;align-items:center;gap:10px;padding:10px 14px;" +
        "margin-bottom:8px;border:1.5px solid #e2e8f0;border-radius:10px;" +
        "cursor:pointer;transition:all .18s;background:#f8fafc;user-select:none;";

      const check = document.createElement("div");
      check.className = `ec-check ${tab.key}`;
      check.style.cssText =
        `width:20px;height:20px;border-radius:50%;border:2px solid ${tab.color};` +
        `display:flex;align-items:center;justify-content:center;` +
        `font-size:.75rem;color:#fff;flex-shrink:0;transition:background .18s;`;

      const chipSpan = document.createElement("span");
      chipSpan.textContent = chipLabel;
      chipSpan.style.cssText = "font-size:.85rem;line-height:1.4;color:#1e293b;";

      chip.appendChild(check);
      chip.appendChild(chipSpan);

      /* Restore selection state if already picked */
      if (tab.selSet.has(i)) {
        chip.classList.add("selected");
        chip.style.borderColor = tab.color;
        chip.style.background  = tab.color + "12";
        check.style.background = tab.color;
        check.textContent      = "✓";
      }

      chip.addEventListener("click", () => {
        if (tab.selSet.has(i)) {
          tab.selSet.delete(i);
          chip.classList.remove("selected");
          chip.style.borderColor = "#e2e8f0";
          chip.style.background  = "#f8fafc";
          check.style.background = "transparent";
          check.textContent      = "";
        } else {
          tab.selSet.add(i);
          chip.classList.add("selected");
          chip.style.borderColor = tab.color;
          chip.style.background  = tab.color + "12";
          check.style.background = tab.color;
          check.textContent      = "✓";
        }
        /* Update badge */
        const b = document.getElementById(`${tab.key}-tab-badge`);
        if (b) {
          b.textContent = tab.selSet.size;
          b.style.background = tab.selSet.size > 0 ? tab.color : "#e2e8f0";
          b.style.color      = tab.selSet.size > 0 ? "#fff"    : "#475569";
        }
        /* Update combined count label */
        updateElectiveCount();
      });

      panel.appendChild(chip);
    });

    /* Tab click → switch panel */
    btn.addEventListener("click", () => switchTab(tab.key));
  });

  block.appendChild(tabBar);
  block.appendChild(panelWrap);

  /* Count label below panels */
  const countRow = document.createElement("p");
  countRow.id = "elective-total-count";
  countRow.style.cssText =
    "font-size:.8rem;color:#64748b;margin:8px 0 0;text-align:right;";
  countRow.textContent = "No clusters selected yet.";
  block.appendChild(countRow);

  /* ── Switch tab helper ── */
  function switchTab(key) {
    TABS.forEach(t => {
      const b = tabBar.querySelector(`[data-tab-key="${t.key}"]`);
      const p = document.getElementById(`elective-panel-${t.key}`);
      if (t.key === key) {
        b.style.background   = "#fff";
        b.style.color        = t.color;
        b.style.borderBottom = `3px solid ${t.color}`;
        if (p) p.style.display = "block";
      } else {
        b.style.background   = "#f8fafc";
        b.style.color        = "#64748b";
        b.style.borderBottom = "3px solid transparent";
        if (p) p.style.display = "none";
      }
    });
  }

  /* Activate the correct tab based on chosen track */
  switchTab(activeTrack === "Academic Strand" ? "academic" : "techpro");

  /* Update badge counts (in case selections existed before) */
  TABS.forEach(t => {
    const b = document.getElementById(`${t.key}-tab-badge`);
    if (b && t.selSet.size > 0) {
      b.textContent      = t.selSet.size;
      b.style.background = t.color;
      b.style.color      = "#fff";
    }
  });
  updateElectiveCount();
}

function updateElectiveCount() {
  const total = acSelection.size + tpSelection.size;
  const el    = document.getElementById("elective-total-count");
  if (!el) return;
  el.textContent = total > 0
    ? `${total} cluster(s) selected across both tracks`
    : "No clusters selected yet.";
  el.style.color = total > 0 ? "#3b82f6" : "#64748b";
}

/** Legacy stub — kept so old call sites don't break */
function buildElectiveChips(containerId, items, type, selSet, countId) {
  /* No-op: replaced by buildElectiveTabs() */
}

/** Build student-type card grid */
function buildStypeGrid() {
  const grid = document.getElementById("stype-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const types = val("gradeLevel") === "Grade 12" ? STYPES_G12 : STYPES_G11;

  const icons  = { "New Student": "🎒", "Transferee": "🔄", "Balik-Aral": "↩️", "Continuing": "📖" };
  const descs  = {
    "New Student":  "Coming from Grade 10 / JHS",
    "Transferee":   "Transferring from another school",
    "Balik-Aral":   "Returning after a gap",
    "Continuing":   "Grade 11 → Grade 12 (same school)"
  };

  types.forEach(t => {
    const card = document.createElement("div");
    card.className   = "stype-card";
    card.dataset.value = t.value;
    card.innerHTML   = `
      <span class="stype-icon">${icons[t.value] || "🎓"}</span>
      <span class="stype-name">${t.value}</span>
      <span class="stype-desc">${descs[t.value] || ""}</span>
      <div class="stype-check"></div>
    `;

    card.addEventListener("click", () => {
      // Deselect all
      document.querySelectorAll(".stype-card").forEach(c => {
        c.classList.remove("selected");
        const chk = c.querySelector(".stype-check");
        if (chk) chk.textContent = "";
      });

      // Select this one
      card.classList.add("selected");
      card.querySelector(".stype-check").textContent = "✓";
      selectedStype = t.value;
      setVal("studentType", t.value);

      // Show/hide previous school field
      const pw = document.getElementById("s2-prev-school-wrap");
      if (pw) {
        pw.style.display = (t.value === "Transferee" || t.value === "Balik-Aral") ? "" : "none";
      }

      show("s2-reason-block");
    });

    grid.appendChild(card);
  });
}

// ── Exposed callbacks used by inline onchange="" attributes ──────

window.s2OnGradeChange = function (grade) {
  resetStep2(1);
  if (!grade) return;

  const lbl = document.getElementById("s2-track-label");

  if (grade === "Grade 11") {
    if (lbl) lbl.textContent = "B. Academic Track & Electives";
    show("s2-track-block");
    show("s2-track-row");
    hide("s2-strand-row");
  } else {
    if (lbl) lbl.textContent = "B. Academic Strand";
    show("s2-track-block");
    hide("s2-track-row");
    show("s2-strand-row");
    populateStudentTypes(STYPES_G12);
  }
};

window.s2OnTrackChange = function (track) {
  resetStep2(2);
  if (!track) {
    hide("s2-electives-block");
    return;
  }

  setVal("strand", track);
  show("s2-electives-block");
  buildElectiveTabs(track); // builds tab+scroll UI for both tracks

  populateStudentTypes(STYPES_G11);
  buildStypeGrid();
  show("s2-stype-block");
};

window.s2OnStrandChange = function (strand) {
  resetStep2(2);
  if (!strand) return;
  setVal("strand", strand);
  populateStudentTypes(STYPES_G12);
  buildStypeGrid();
  show("s2-stype-block");
};

window.s2OnStypeChange = function (stype) {
  hide("s2-reason-block");
  const pw = document.getElementById("s2-prev-school-wrap");
  if (pw) {
    pw.style.display = (stype === "Transferee" || stype === "Balik-Aral") ? "" : "none";
    if (pw.style.display === "none") setVal("prevSchool", "");
  }
  if (stype) show("s2-reason-block");
};

/** Step 2 field-level validation (called by validateStep) */
window.__step2Validate = function () {
  const grade = val("gradeLevel");
  if (!grade) {
    alert("⚠️ Please select a Grade Level.");
    return false;
  }

  const strand = val("strand");
  if (!strand) {
    alert(grade === "Grade 11"
      ? "⚠️ Please select an Academic Track."
      : "⚠️ Please select a Strand.");
    return false;
  }

  const stype = selectedStype || val("studentType");
  if (!stype) {
    alert("⚠️ Please select a Classification of Applicant.");
    return false;
  }

  if ((stype === "Transferee" || stype === "Balik-Aral") && !val("prevSchool")) {
    alert("⚠️ Please enter the name of your previous school.");
    return false;
  }

  return true;
};

/** Return all Step 2 data as a plain object (used by submit) */
function getStep2Data() {
  const grade  = val("gradeLevel");
  const track  = val("trackSelect");
  const strand = val("strandSelect") || val("strand");
  const reason = val("interviewReason");
  const prev   = val("prevSchool");
  const stype  = selectedStype || val("studentType");

  const electives = track === "Academic Strand"
    ? [...acSelection].map(i => ACADEMIC_ELECTIVES[i])
    : [...tpSelection].map(i => TECHPRO_ELECTIVES[i]);

  return { grade, track, strand, studentType: stype, electives, prevSchool: prev, statementPurpose: reason };
}


// ============================================================
//  STEP 3 — REVIEW SUMMARY
// ============================================================

function populateReview() {
  const s2 = getStep2Data();

  const address = [
    val("street"),
    val("barangay"),
    val("municipality"),
    val("province"),
    val("zipCode")
  ].filter(Boolean).join(", ");

  const fields = [
    ["Full Name",         val("fullName")                       ],
    ["Age",               val("age")                            ],
    ["Date of Birth",     val("birthday")                       ],
    ["LRN",               val("lrn")                            ],
    ["Gender",            val("gender")                         ],
    ["Gmail",             val("gmail")                          ],
    ["Address",           address || "—"                        ],
    ["Grade Level",       s2.grade                              ],
    ["Track / Strand",    s2.strand                             ],
    ["Student Type",      s2.studentType                        ],
    ["Electives",         s2.electives.length
                          ? s2.electives.join(", ")
                          : "None selected"                     ],
    ["Previous School",   s2.prevSchool || "—"                  ],
    ["Statement",         s2.statementPurpose || "—"            ]
  ];

  const html = fields.map(([label, value]) => `
    <div class="review-row">
      <span class="review-label">${label}</span>
      <span class="review-value">${value || "—"}</span>
    </div>
  `).join("");

  const container = document.getElementById("reviewSummary");
  if (container) container.innerHTML = html;
}


// ============================================================
//  FIREBASE SUBMIT
// ============================================================

async function submitRegistration() {
  const btn     = document.getElementById("submitBtn");
  const overlay = document.getElementById("submitOverlay");
  const msg     = document.getElementById("overlayMsg");

  // Disable button & show overlay
  if (btn) {
    btn.disabled   = true;
    btn.textContent = "Processing...";
  }
  if (overlay) overlay.classList.add("show");
  if (msg)     msg.textContent = "Saving your registration…";

  try {
    const refNum = generateRefNumber();
    const s2     = getStep2Data();

    const address = [
      val("street"),
      val("barangay"),
      val("municipality"),
      val("province"),
      val("zipCode")
    ].filter(Boolean).join(", ");

    // ── Firestore document ────────────────────────────────────
    const enrollmentData = {
      // Meta
      refNumber:      refNum,
      status:         "pending",         // admin can update: pending / approved / rejected
      submittedAt:    serverTimestamp(),

      // Step 1 — Personal
      fullName:       val("fullName"),
      age:            val("age"),
      birthday:       val("birthday"),
      lrn:            val("lrn"),
      gender:         val("gender"),
      gmail:          val("gmail"),

      // Address fields (combined + individual)
      address,
      street:         val("street"),
      barangay:       val("barangay"),
      municipality:   val("municipality"),
      province:       val("province"),
      zipCode:        val("zipCode"),

      // Step 2 — Academic
      gradeLevel:     s2.grade,
      track:          s2.track,
      strand:         s2.strand,
      studentType:    s2.studentType,
      electives:      s2.electives,
      prevSchool:     s2.prevSchool,
      statementPurpose: s2.statementPurpose,

      // Documents — to be confirmed by admin after in-person visit
      reportCard:     null,
      form137:        null,
      documentsSubmitted: false,

      // Admin notes — blank by default
      adminNotes:     ""
    };

    await addDoc(collection(db, "enrollments"), enrollmentData);

    // ── Success ───────────────────────────────────────────────
    if (overlay)  overlay.classList.remove("show");

    // Hide form steps and progress
    formSteps.forEach(s => s.classList.remove("active"));
    const pw = document.getElementById("progressWrap");
    if (pw)  pw.style.display = "none";

    // Show reference number on success screen
    const refEl = document.getElementById("refNumber");
    if (refEl) refEl.textContent = refNum;

    const successEl = document.getElementById("successScreen");
    if (successEl) successEl.classList.add("active");

    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err) {
    // ── Error ─────────────────────────────────────────────────
    if (overlay) overlay.classList.remove("show");
    if (btn) {
      btn.disabled    = false;
      btn.textContent = "Submit Registration ✓";
    }
    console.error("Submission error:", err);
    alert(
      "❌ Submission failed. Please check your internet connection and try again.\n\n" +
      "Error: " + err.message
    );
  }
}


// ============================================================
//  INIT — run on page load
// ============================================================

checkEnrollmentStatus();