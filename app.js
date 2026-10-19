// ===================================================================
// Cashper HR Portal - Admin Dashboard Logic
// Clean Dashboard, Collapsible Sidebar, Google Icons, Zero Gradients
// ===================================================================

const DEFAULT_CONFIG = {
  url: 'https://bzlrrxrljwprmhmxxkql.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bHJyeHJsandwcm1obXh4a3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTEwMjAsImV4cCI6MjEwNjc2NzAyMH0.wZAT2xtJ3VbbM-4pY2b6UpVC2_gRGMYMOv0jCewO2DQ'
};

let supabaseClient = null;
let allEmployees = [];
let allWithdrawals = [];
let allEdukasiVideos = [];

const EWA_SUBSIDY_FEE_PER_TX = 1250; // Fee subsidi perusahaan per transaksi EWA (Rp 1.250 / tx)
let selectedEwaMonthFilter = 'current'; // 'current' (bulan berjalan), 'all', atau 'YYYY-MM'

const SUPABASE_URL = DEFAULT_CONFIG.url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const STORAGE_BUCKET = 'edukasi-videos';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  loadEmployees();
  loadWithdrawals();
});

// -------------------------------------------------------------------
// 1. Supabase Initialization (Silent, No connection banners/tabs)
// -------------------------------------------------------------------
function initSupabase() {
  try {
    const cleanUrl = DEFAULT_CONFIG.url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    supabaseClient = window.supabase.createClient(cleanUrl, DEFAULT_CONFIG.anonKey);
  } catch (err) {
    console.error('Supabase initialization failed:', err);
    showToast('Gagal memuat client Supabase', 'error');
  }
}

// -------------------------------------------------------------------
// 2. Sidebar & Navigation Logic
// -------------------------------------------------------------------
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const appLayout = document.getElementById('appLayout');

  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    appLayout.classList.toggle('collapsed');
  }
}

function navigate(sectionId) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  // Section titles
  const titles = {
    overview: 'Dashboard Ringkasan',
    employees: 'Data & Direktori Karyawan',
    withdrawals: 'Riwayat Transaksi EWA',
    payroll: 'Rekap Pemotongan Payroll',
    edukasi: 'Manajemen Video Edukasi'
  };

  const navMap = {
    overview: 'navOverview',
    employees: 'navEmployees',
    withdrawals: 'navWithdrawals',
    payroll: 'navPayroll',
    edukasi: 'navEdukasi'
  };

  const sectionEl = document.getElementById('section' + sectionId.charAt(0).toUpperCase() + sectionId.slice(1));
  const navEl = document.getElementById(navMap[sectionId]);
  const titleEl = document.getElementById('pageTitle');

  if (sectionEl) sectionEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  if (titleEl && titles[sectionId]) titleEl.textContent = titles[sectionId];

  // Refresh data on navigation
  if (sectionId === 'employees') loadEmployees();
  if (sectionId === 'withdrawals') loadWithdrawals();
  if (sectionId === 'payroll') loadPayrollRecap();
  if (sectionId === 'edukasi') loadEdukasiVideos();
  if (sectionId === 'overview') {
    loadEmployees();
    loadWithdrawals();
  }

  // Close mobile sidebar if open
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
}

// -------------------------------------------------------------------
// 3. Employee Management (List, Filter, Add, Edit, Toggle)
// -------------------------------------------------------------------
async function loadEmployees() {
  const tbody = document.getElementById('employeesTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Memuat data karyawan...</td></tr>';

  try {
    // Attempt 1: Call admin_get_employees RPC
    const { data: rpcData, error: rpcError } = await supabaseClient.rpc('admin_get_employees');

    let list = [];
    if (!rpcError && Array.isArray(rpcData)) {
      list = rpcData;
    } else {
      // Fallback: Direct select on employees table
      const { data, error } = await supabaseClient
        .from('employees')
        .select('id, full_name, email, company, bank_name, bank_account_number, payday_day, is_active, created_at, role_id, roles(name, base_salary)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      list = (data || []).map(e => ({
        id: e.id,
        full_name: e.full_name,
        email: e.email || '-',
        company: e.company || 'Cashper',
        role_id: e.role_id,
        role_name: e.roles?.name || (e.role_id === 1 ? 'Staff Operasional' : e.role_id === 2 ? 'Supervisor' : 'Manager'),
        base_salary: e.roles?.base_salary || (e.role_id === 1 ? 4000000 : e.role_id === 2 ? 7000000 : 12000000),
        bank_name: e.bank_name,
        bank_account_number: e.bank_account_number,
        payday_day: e.payday_day,
        is_active: e.is_active,
        created_at: e.created_at
      }));
    }

    allEmployees = list;
    renderEmployeesTable(allEmployees);
    updateOverviewStats();

  } catch (err) {
    console.error('loadEmployees error:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty text-red">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderEmployeesTable(list) {
  const tbody = document.getElementById('employeesTableBody');

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada karyawan. Klik tombol "+ Tambah Karyawan" untuk mendaftarkan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(emp => {
    const maskedAcc = emp.bank_account_number
      ? emp.bank_account_number.slice(0, 3) + 'â€¢â€¢â€¢â€¢' + emp.bank_account_number.slice(-3)
      : '-';

    const statusBadge = emp.is_active
      ? '<span class="status-tag active"><span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Aktif</span>'
      : '<span class="status-tag inactive"><span class="material-symbols-rounded" style="font-size:14px;">cancel</span> Nonaktif</span>';

    const toggleText = emp.is_active ? 'Nonaktifkan' : 'Aktifkan';
    const isCompanyAccount = emp.email && emp.email.toLowerCase() === 'halo.cashper@gmail.com';
    const salaryDisplay = isCompanyAccount ? '<span class="emp-sub">Non-EWA (HR Perusahaan)</span>' : `<div class="emp-salary">${formatRupiah(emp.base_salary)}</div>`;
    const companyBadge = isCompanyAccount ? '<span style="font-size:10px; background:#29153f; color:#bf5ae8; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:2px;">Akun HR Perusahaan</span>' : '';

    return `
      <tr>
        <td>
          <div class="emp-name">${escapeHtml(emp.full_name)}</div>
          <div class="emp-sub">${escapeHtml(emp.email)}</div>
          ${companyBadge}
        </td>
        <td>
          <div>${escapeHtml(emp.role_name || 'Staff')}</div>
          ${salaryDisplay}
        </td>
        <td>${escapeHtml(emp.company || 'Cashper')}</td>
        <td>
          <div><strong>${escapeHtml(emp.bank_name || '-')}</strong></div>
          <div class="emp-sub">${maskedAcc}</div>
        </td>
        <td>Tgl ${emp.payday_day || 28}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-row-actions">
            <button class="btn btn-secondary btn-sm" onclick="openEditModalById('${emp.id}')" title="Edit Data Karyawan">
              <span class="material-symbols-rounded" style="font-size: 16px;">edit</span>
              <span>Edit</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="toggleEmployeeStatus('${emp.id}', ${emp.is_active})" title="${toggleText}">
              <span class="material-symbols-rounded" style="font-size: 16px;">${emp.is_active ? 'power_settings_new' : 'check'}</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterEmployees() {
  const query = (document.getElementById('employeeSearchInput').value || '').trim().toLowerCase();
  if (!query) {
    renderEmployeesTable(allEmployees);
    return;
  }

  const filtered = allEmployees.filter(e =>
    (e.full_name || '').toLowerCase().includes(query) ||
    (e.email || '').toLowerCase().includes(query) ||
    (e.company || '').toLowerCase().includes(query) ||
    (e.bank_name || '').toLowerCase().includes(query) ||
    (e.role_name || '').toLowerCase().includes(query)
  );

  renderEmployeesTable(filtered);
}

// -------------------------------------------------------------------
// 4. Modal Handlers (Add & Edit Employee)
// -------------------------------------------------------------------
function openAddEmployeeModal() {
  document.getElementById('addEmployeeForm').reset();
  document.getElementById('addCompany').value = 'Cashper';
  document.getElementById('addPassword').value = 'cashper123';
  document.getElementById('addBank').value = 'BRI';
  document.getElementById('addPayday').value = '28';
  document.getElementById('addEmployeeModal').classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

// Create Employee Handler
async function handleCreateEmployee(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitAdd');
  const btnText = document.getElementById('textSubmitAdd');

  const fullName = document.getElementById('addFullName').value.trim();
  const email = document.getElementById('addEmail').value.trim().toLowerCase();
  const password = document.getElementById('addPassword').value;
  const roleId = parseInt(document.getElementById('addRole').value, 10);
  const company = document.getElementById('addCompany').value.trim() || 'Cashper';
  const bankName = document.getElementById('addBank').value;
  const accountNumber = document.getElementById('addAccount').value.trim();
  const payday = parseInt(document.getElementById('addPayday').value || '28', 10);

  if (!fullName || !email || !password || !accountNumber) {
    showToast('Lengkapi semua kolom formulir', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Mendaftarkan...';

  try {
    let newUserId = null;

    // 1. First attempt: Native GoTrue Auth signUp
    try {
      const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            company: company
          }
        }
      });
      if (!authErr && authData && authData.user) {
        newUserId = authData.user.id;
      }
    } catch (authException) {
      console.warn('Native signup exception, falling back:', authException);
    }

    // 2. Link employee profile to database
    if (newUserId) {
      const { error: linkErr } = await supabaseClient.rpc('admin_link_employee_profile', {
        p_user_id: newUserId,
        p_email: email,
        p_full_name: fullName,
        p_company: company,
        p_role_id: roleId,
        p_bank_name: bankName,
        p_bank_account_number: accountNumber,
        p_payday_day: payday
      });
      if (linkErr) throw linkErr;
    } else {
      // Fallback: Use direct RPC admin_register_employee
      const { error: rpcErr } = await supabaseClient.rpc('admin_register_employee', {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_company: company,
        p_role_id: roleId,
        p_bank_name: bankName,
        p_bank_account_number: accountNumber,
        p_payday_day: payday
      });
      if (rpcErr) throw rpcErr;
    }

    showToast(`Karyawan ${fullName} berhasil didaftarkan!`, 'success');
    closeModal('addEmployeeModal');
    loadEmployees();

  } catch (err) {
    console.error('Registration failed:', err);
    showToast(err.message || 'Gagal mendaftarkan karyawan', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Simpan & Daftarkan';
  }
}

// Open Edit Modal with Employee Data
function openEditModalById(empId) {
  const emp = allEmployees.find(e => e.id === empId);
  if (!emp) {
    showToast('Data karyawan tidak ditemukan', 'error');
    return;
  }

  document.getElementById('editEmployeeId').value = emp.id;
  document.getElementById('editFullName').value = emp.full_name || '';
  document.getElementById('editEmail').value = emp.email || '';
  document.getElementById('editRole').value = emp.role_id || 1;
  document.getElementById('editCompany').value = emp.company || 'Cashper';
  document.getElementById('editBank').value = emp.bank_name || 'BRI';
  document.getElementById('editAccount').value = emp.bank_account_number || '';
  document.getElementById('editPayday').value = emp.payday_day || 28;

  document.getElementById('editEmployeeModal').classList.add('show');
}

// Update Employee Handler
async function handleUpdateEmployee(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitEdit');
  const btnText = document.getElementById('textSubmitEdit');

  const empId = document.getElementById('editEmployeeId').value;
  const fullName = document.getElementById('editFullName').value.trim();
  const roleId = parseInt(document.getElementById('editRole').value, 10);
  const company = document.getElementById('editCompany').value.trim() || 'Cashper';
  const bankName = document.getElementById('editBank').value;
  const accountNumber = document.getElementById('editAccount').value.trim();
  const payday = parseInt(document.getElementById('editPayday').value || '28', 10);

  if (!empId || !fullName || !accountNumber) {
    showToast('Lengkapi data sebelum menyimpan', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Menyimpan...';

  try {
    // Call admin_update_employee RPC
    const { data, error } = await supabaseClient.rpc('admin_update_employee', {
      p_employee_id: empId,
      p_full_name: fullName,
      p_role_id: roleId,
      p_company: company,
      p_bank_name: bankName,
      p_bank_account_number: accountNumber,
      p_payday_day: payday
    });

    if (error) {
      // Fallback: Direct table update
      const { error: directErr } = await supabaseClient
        .from('employees')
        .update({
          full_name: fullName,
          role_id: roleId,
          company: company,
          bank_name: bankName,
          bank_account_number: accountNumber,
          payday_day: payday
        })
        .eq('id', empId);

      if (directErr) throw directErr;
    }

    showToast(`Data karyawan ${fullName} berhasil diperbarui!`, 'success');
    closeModal('editEmployeeModal');
    loadEmployees();

  } catch (err) {
    console.error('Update failed:', err);
    showToast(err.message || 'Gagal menyimpan perubahan karyawan', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Simpan Perubahan';
  }
}

// Toggle Employee Status
async function toggleEmployeeStatus(empId, currentActive) {
  const newStatus = !currentActive;
  const actionName = newStatus ? 'mengaktifkan' : 'menonaktifkan';

  try {
    const { error } = await supabaseClient.rpc('admin_toggle_employee_status', {
      p_employee_id: empId,
      p_active: newStatus
    });

    if (error) {
      // Direct table fallback
      const { error: directErr } = await supabaseClient
        .from('employees')
        .update({ is_active: newStatus })
        .eq('id', empId);
      if (directErr) throw directErr;
    }

    showToast(`Berhasil ${actionName} karyawan`, 'success');
    loadEmployees();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

// -------------------------------------------------------------------
// -------------------------------------------------------------------
// 5. Withdrawals & Subsidi Management (Rp 1.250 / tx)
// -------------------------------------------------------------------
function getYearMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getCurrentYearMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthYearLabel(ymKey) {
  if (!ymKey) return '-';
  const parts = ymKey.split('-');
  if (parts.length !== 2) return ymKey;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

async function loadWithdrawals() {
  const tbodyFull = document.getElementById('withdrawalsTableBody');
  const tbodyOverview = document.getElementById('overviewWithdrawalsBody');

  if (tbodyFull) tbodyFull.innerHTML = '<tr><td colspan="8" class="table-empty">Memuat transaksi...</td></tr>';
  if (tbodyOverview) tbodyOverview.innerHTML = '<tr><td colspan="4" class="table-empty">Memuat transaksi...</td></tr>';

  try {
    // Call admin_get_withdrawals RPC
    const { data: rpcData, error: rpcError } = await supabaseClient.rpc('admin_get_withdrawals');

    let list = [];
    if (!rpcError && Array.isArray(rpcData)) {
      list = rpcData;
    } else {
      // Direct table query fallback
      const { data, error } = await supabaseClient
        .from('ewa_withdrawals')
        .select('id, reference_id, amount, fee, net_amount, bank_name, bank_account_masked, status, created_at, employees(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      list = (data || []).map(w => ({
        id: w.id,
        reference_id: w.reference_id,
        employee_name: w.employees?.full_name || 'Karyawan',
        email: w.employees?.email || '-',
        amount: w.amount,
        fee: w.fee,
        net_amount: w.net_amount,
        bank_name: w.bank_name,
        bank_account_masked: w.bank_account_masked,
        status: w.status,
        created_at: w.created_at
      }));
    }

    allWithdrawals = list;

    // Inisialisasi dropdown filter bulan & kalkulasi tampilan
    populateEwaMonthFilter();
    applyEwaFilterAndRender();
    renderMonthlySubsidyArchive();
    renderOverviewWithdrawals(allWithdrawals.slice(0, 5));
    updateOverviewStats();

  } catch (err) {
    console.error('loadWithdrawals error:', err);
    if (tbodyFull) tbodyFull.innerHTML = `<tr><td colspan="8" class="table-empty text-red">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    if (tbodyOverview) tbodyOverview.innerHTML = `<tr><td colspan="4" class="table-empty text-red">Gagal memuat transaksi</td></tr>`;
  }
}

function populateEwaMonthFilter() {
  const filterSelect = document.getElementById('ewaMonthFilter');
  if (!filterSelect) return;

  const currentYm = getCurrentYearMonthKey();
  const currentLabel = formatMonthYearLabel(currentYm);

  // Kumpulkan unique YYYY-MM dari seluruh data transaksi
  const monthsSet = new Set();
  allWithdrawals.forEach(w => {
    const ym = getYearMonthKey(w.created_at);
    if (ym) monthsSet.add(ym);
  });

  const sortedMonths = Array.from(monthsSet).sort().reverse();

  let html = `
    <option value="current">Bulan Ini (${currentLabel})</option>
    <option value="all">Semua Riwayat (All-Time)</option>
  `;

  sortedMonths.forEach(ym => {
    if (ym !== currentYm) {
      html += `<option value="${ym}">${formatMonthYearLabel(ym)}</option>`;
    }
  });

  filterSelect.innerHTML = html;
  filterSelect.value = selectedEwaMonthFilter;
}

function onEwaMonthFilterChange() {
  const filterSelect = document.getElementById('ewaMonthFilter');
  if (!filterSelect) return;
  selectedEwaMonthFilter = filterSelect.value;
  applyEwaFilterAndRender();
}

function filterEwaByMonth(ym) {
  selectedEwaMonthFilter = ym;
  const filterSelect = document.getElementById('ewaMonthFilter');
  if (filterSelect) {
    filterSelect.value = ym;
  }
  applyEwaFilterAndRender();

  const sec = document.getElementById('sectionWithdrawals');
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function applyEwaFilterAndRender() {
  const currentYm = getCurrentYearMonthKey();

  // 1. Transaksi Bulan Berjalan (Reset tiap pergantian bulan baru)
  const currentMonthTx = allWithdrawals.filter(w => getYearMonthKey(w.created_at) === currentYm);
  const currentMonthSubsidy = currentMonthTx.length * EWA_SUBSIDY_FEE_PER_TX;

  const currentSubsidyEl = document.getElementById('ewaSubsidyCurrentMonth');
  const currentCountEl = document.getElementById('ewaCountCurrentMonth');
  if (currentSubsidyEl) currentSubsidyEl.textContent = formatRupiah(currentMonthSubsidy);
  if (currentCountEl) currentCountEl.textContent = currentMonthTx.length;

  // 2. Transaksi Sesuai Filter Pilihan
  let filteredList = [];
  let periodLabel = 'Bulan Berjalan';

  if (selectedEwaMonthFilter === 'current') {
    filteredList = currentMonthTx;
    periodLabel = formatMonthYearLabel(currentYm);
  } else if (selectedEwaMonthFilter === 'all') {
    filteredList = allWithdrawals;
    periodLabel = 'Semua Waktu';
  } else {
    filteredList = allWithdrawals.filter(w => getYearMonthKey(w.created_at) === selectedEwaMonthFilter);
    periodLabel = formatMonthYearLabel(selectedEwaMonthFilter);
  }

  const selectedSubsidy = filteredList.length * EWA_SUBSIDY_FEE_PER_TX;
  const selectedSubsidyEl = document.getElementById('ewaSubsidySelectedPeriod');
  const selectedCountEl = document.getElementById('ewaCountSelectedPeriod');
  const selectedLabelEl = document.getElementById('ewaSelectedPeriodLabel');

  if (selectedSubsidyEl) selectedSubsidyEl.textContent = formatRupiah(selectedSubsidy);
  if (selectedCountEl) selectedCountEl.textContent = filteredList.length;
  if (selectedLabelEl) selectedLabelEl.textContent = periodLabel;

  // 3. Total Akumulasi Seluruh Waktu
  const allTimeSubsidy = allWithdrawals.length * EWA_SUBSIDY_FEE_PER_TX;
  const allTimeSubsidyEl = document.getElementById('ewaSubsidyAllTime');
  const allTimeCountEl = document.getElementById('ewaCountAllTime');
  if (allTimeSubsidyEl) allTimeSubsidyEl.textContent = formatRupiah(allTimeSubsidy);
  if (allTimeCountEl) allTimeCountEl.textContent = allWithdrawals.length;

  // Render Tabel
  renderWithdrawalsTable(filteredList);
}

function renderWithdrawalsTable(list) {
  const tbody = document.getElementById('withdrawalsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Belum ada transaksi pencairan EWA pada periode ini.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(w => {
    const isSuccess = w.status === 'success' || w.status === 'disbursed' || w.status === 'completed';
    const statusClass = isSuccess ? 'disbursed' : 'pending';
    const statusLabel = isSuccess ? 'Tersalurkan' : 'Diproses';

    const actionCell = isSuccess
      ? `<span style="font-size: 0.76rem; color: var(--text-muted);">Selesai</span>`
      : `<button class="btn btn-primary btn-sm" onclick="markWithdrawalSuccess('${w.id}')" title="Selesaikan transaksi ini">
           <span class="material-symbols-rounded" style="font-size: 15px;">check_circle</span>
           <span>Selesaikan</span>
         </button>`;

    return `
      <tr>
        <td><code>${escapeHtml(w.reference_id || (w.id ? w.id.substring(0, 8) : '-'))}</code></td>
        <td>
          <div class="emp-name">${escapeHtml(w.employee_name || '-')}</div>
          <div class="emp-sub">${escapeHtml(w.email || '-')}</div>
        </td>
        <td class="emp-salary"><strong>${formatRupiah(w.amount)}</strong></td>
        <td>
          <div class="subsidy-badge">
            <span class="material-symbols-rounded" style="font-size: 13px;">check_circle</span>
            <span>Rp 1.250</span>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Disubsidi Kantor</div>
        </td>
        <td>${escapeHtml(w.bank_name || '-')} (${escapeHtml(w.bank_account_masked || '-')})</td>
        <td class="emp-sub">${formatDateTime(w.created_at)}</td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
        <td style="text-align: right;">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function renderMonthlySubsidyArchive() {
  const tbody = document.getElementById('monthlySubsidyTableBody');
  if (!tbody) return;

  const currentYm = getCurrentYearMonthKey();

  // Group withdrawals per YYYY-MM
  const monthMap = {};
  monthMap[currentYm] = []; // Pastikan bulan berjalan selalu ada di baris pertama

  allWithdrawals.forEach(w => {
    const ym = getYearMonthKey(w.created_at);
    if (!ym) return;
    if (!monthMap[ym]) {
      monthMap[ym] = [];
    }
    monthMap[ym].push(w);
  });

  const sortedMonths = Object.keys(monthMap).sort().reverse();

  if (sortedMonths.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Belum ada riwayat subsidi bulanan.</td></tr>';
    return;
  }

  tbody.innerHTML = sortedMonths.map(ym => {
    const txList = monthMap[ym] || [];
    const count = txList.length;
    const totalAmount = txList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalSubsidy = count * EWA_SUBSIDY_FEE_PER_TX;
    const isCurrent = ym === currentYm;

    const statusBadge = isCurrent
      ? `<span class="status-tag active"><span class="material-symbols-rounded" style="font-size: 13px;">schedule</span> Bulan Berjalan</span>`
      : `<span class="status-tag" style="background: var(--border-subtle); color: var(--text-muted);"><span class="material-symbols-rounded" style="font-size: 13px;">archive</span> Arsip Terlewati</span>`;

    const actionButton = `
      <button class="btn btn-secondary btn-sm" onclick="filterEwaByMonth('${ym}')" title="Filter transaksi bulan ini">
        <span class="material-symbols-rounded" style="font-size: 14px;">visibility</span>
        <span>Lihat Transaksi</span>
      </button>
    `;

    return `
      <tr>
        <td><strong>${formatMonthYearLabel(ym)}</strong></td>
        <td>${statusBadge}</td>
        <td>${count} Transaksi</td>
        <td>${formatRupiah(totalAmount)}</td>
        <td>
          <strong class="text-green">${formatRupiah(totalSubsidy)}</strong>
          <div style="font-size: 0.7rem; color: var(--text-muted);">Rp 1.250 × ${count} tx</div>
        </td>
        <td style="text-align: right;">${actionButton}</td>
      </tr>
    `;
  }).join('');
}

function renderOverviewWithdrawals(list) {
  const tbody = document.getElementById('overviewWithdrawalsBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Belum ada riwayat transaksi EWA.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(w => {
    const isSuccess = w.status === 'success' || w.status === 'disbursed' || w.status === 'completed';
    const statusClass = isSuccess ? 'disbursed' : 'pending';
    const statusLabel = isSuccess ? 'Tersalurkan' : 'Diproses';

    return `
      <tr>
        <td><code>${escapeHtml(w.reference_id || (w.id ? w.id.substring(0, 8) : '-'))}</code></td>
        <td><strong>${escapeHtml(w.employee_name || '-')}</strong></td>
        <td>${formatRupiah(w.amount)}</td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------------
// 6. Stats & Overview Calculation
// -------------------------------------------------------------------
function updateOverviewStats() {
  // Total Employees
  const totalEmpEl = document.getElementById('overviewTotalEmployees');
  if (totalEmpEl) totalEmpEl.textContent = allEmployees.length;

  // Withdrawals Summary
  const totalWitEl = document.getElementById('overviewTotalWithdrawals');
  const totalAmtEl = document.getElementById('overviewTotalAmount');

  const disbursedList = allWithdrawals.filter(w => w.status === 'success' || w.status === 'disbursed' || w.status === 'completed' || w.status === 'approved');
  const totalDisbursedCount = disbursedList.length || allWithdrawals.length;
  const totalDisbursedAmount = (disbursedList.length > 0 ? disbursedList : allWithdrawals)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (totalWitEl) totalWitEl.textContent = totalDisbursedCount;
  if (totalAmtEl) totalAmtEl.textContent = formatRupiah(totalDisbursedAmount);

  // Subsidi Bulan Ini di Overview
  const currentYm = getCurrentYearMonthKey();
  const currentMonthTx = allWithdrawals.filter(w => getYearMonthKey(w.created_at) === currentYm);
  const currentSubsidy = currentMonthTx.length * EWA_SUBSIDY_FEE_PER_TX;

  const overviewSubsidyEl = document.getElementById('overviewMonthlySubsidy');
  const overviewSubsidyCountEl = document.getElementById('overviewMonthlySubsidyTxCount');

  if (overviewSubsidyEl) overviewSubsidyEl.textContent = formatRupiah(currentSubsidy);
  if (overviewSubsidyCountEl) overviewSubsidyCountEl.textContent = currentMonthTx.length;
}

// Mark pending withdrawal as success (Tersalurkan)
async function markWithdrawalSuccess(id) {
  try {
    const { error } = await supabaseClient.rpc('admin_set_withdrawal_status', {
      p_withdrawal_id: id,
      p_status: 'success'
    });

    if (error) {
      // Direct table fallback
      const { error: directErr } = await supabaseClient
        .from('ewa_withdrawals')
        .update({ status: 'success' })
        .eq('id', id);
      if (directErr) throw directErr;
    }

    showToast('Transaksi berhasil diselesaikan & berstatus Tersalurkan!', 'success');
    loadWithdrawals();
  } catch (err) {
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

async function clearAllWithdrawals() {
  if (!confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA data riwayat transaksi EWA di seluruh akun karyawan agar data kembali fresh (bersih/nol)?')) {
    return;
  }
  try {
    const { error } = await supabaseClient.rpc('admin_clear_all_withdrawals');
    if (error) {
      // Direct delete fallback
      const { error: delErr } = await supabaseClient
        .from('ewa_withdrawals')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) throw delErr;
    }
    showToast('Semua data transaksi EWA berhasil dibersihkan! Saldo & limit karyawan kembali utuh.', 'success');
    allWithdrawals = [];
    loadWithdrawals();
    loadDashboardStats();
    loadPayrollRecap();
  } catch (err) {
    showToast('Gagal membersihkan data: ' + err.message, 'error');
  }
}

// -------------------------------------------------------------------
// 7. Payroll Deduction (Pemotongan Gaji Akhir Bulan)
// -------------------------------------------------------------------
async function loadPayrollRecap() {
  const tbody = document.getElementById('payrollTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Menghitung rekap payroll karyawan...</td></tr>';

  // Make sure both employees and withdrawals are loaded
  if (allEmployees.length === 0) {
    await loadEmployees();
  }
  if (allWithdrawals.length === 0) {
    await loadWithdrawals();
  }

  if (allEmployees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Belum ada data karyawan.</td></tr>';
    return;
  }

  let totalDeductionAll = 0;
  let totalNetPayAll = 0;
  let activeEwaCount = 0;
  let totalSubsidyMonthAll = 0;

  const rows = allEmployees.map(emp => {
    const isCompany = emp.email && emp.email.toLowerCase() === 'halo.cashper@gmail.com';
    if (isCompany) {
      return `
        <tr style="opacity: 0.85;">
          <td>
            <div class="emp-name">${escapeHtml(emp.full_name)} <span style="font-size:10px; background:#29153f; color:#bf5ae8; padding:2px 6px; border-radius:4px;">HR Admin</span></div>
            <div class="emp-sub">${escapeHtml(emp.email)}</div>
          </td>
          <td>
            <div>${escapeHtml(emp.role_name || 'HR Admin')}</div>
            <div class="emp-sub">${escapeHtml(emp.company || 'Cashper')}</div>
          </td>
          <td><em>Akun Perusahaan</em></td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="status-tag" style="background:var(--border-subtle); color:var(--text-muted);">Non-EWA</span></td>
        </tr>
      `;
    }

    const empWithdrawals = allWithdrawals.filter(w => {
      const matchEmail = w.email && emp.email && w.email.toLowerCase() === emp.email.toLowerCase();
      const matchName = w.employee_name && emp.full_name && w.employee_name.toLowerCase() === emp.full_name.toLowerCase();
      return matchEmail || matchName;
    });

    const totalEwa = empWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const countEwa = empWithdrawals.length;
    const employeeSubsidy = countEwa * EWA_SUBSIDY_FEE_PER_TX;
    const baseSalary = Number(emp.base_salary || 4000000);
    const netPayday = Math.max(0, baseSalary - totalEwa);

    totalDeductionAll += totalEwa;
    totalNetPayAll += netPayday;
    totalSubsidyMonthAll += employeeSubsidy;
    if (countEwa > 0) activeEwaCount++;

    const statusBadge = countEwa > 0
      ? '<span class="status-tag active"><span class="material-symbols-rounded" style="font-size:14px;">cut</span> Potong Slip Payday</span>'
      : '<span class="status-tag" style="background-color: var(--border-subtle); color: var(--text-muted);"><span class="material-symbols-rounded" style="font-size:14px;">check</span> Gaji Utuh</span>';

    return `
      <tr>
        <td>
          <div class="emp-name">${escapeHtml(emp.full_name)}</div>
          <div class="emp-sub">${escapeHtml(emp.email)}</div>
        </td>
        <td>
          <div>${escapeHtml(emp.role_name || 'Staff')}</div>
          <div class="emp-sub">${escapeHtml(emp.bank_name || '-')}</div>
        </td>
        <td><strong>${formatRupiah(baseSalary)}</strong></td>
        <td><strong class="text-purple">${formatRupiah(totalEwa)}</strong></td>
        <td>${countEwa}x Akses</td>
        <td>
          <strong class="text-green">${formatRupiah(employeeSubsidy)}</strong>
          <div class="emp-sub" style="font-size: 0.7rem; color: var(--text-muted);">Ditanggung Kantor</div>
        </td>
        <td><strong class="text-green">${formatRupiah(netPayday)}</strong></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;

  // Update Summary Metrics
  const deductionEl = document.getElementById('payrollTotalDeduction');
  const countEl = document.getElementById('payrollEmployeesWithdrawn');
  const subsidyEl = document.getElementById('payrollTotalSubsidy');

  if (deductionEl) deductionEl.textContent = formatRupiah(totalDeductionAll);
  if (countEl) countEl.textContent = `${activeEwaCount} Karyawan`;
  if (subsidyEl) subsidyEl.textContent = formatRupiah(totalSubsidyMonthAll);
}

function copyPayrollRecap() {
  if (allEmployees.length === 0) {
    showToast('Tidak ada data payroll untuk disalin', 'error');
    return;
  }

  const currentYm = getCurrentYearMonthKey();
  let text = `REKAP PEMOTONGAN GAJI (PAYROLL DEDUCTION) - CASHPER\n`;
  text += `Periode: ${formatMonthYearLabel(currentYm)}\n`;
  text += `Biaya Subsidi Kantor: Rp 1.250 / transaksi EWA (Ditanggung Perusahaan)\n`;
  text += `--------------------------------------------------------------------------------\n`;
  text += `Nama | Gaji Pokok | Total EWA Dicairkan | Subsidi Kantor | Sisa Ditransfer Payday\n`;
  text += `--------------------------------------------------------------------------------\n`;

  let totalSubsidyAll = 0;
  let totalEwaAll = 0;

  allEmployees.forEach(emp => {
    const isCompany = emp.email && emp.email.toLowerCase() === 'halo.cashper@gmail.com';
    if (isCompany) return;

    const empWithdrawals = allWithdrawals.filter(w => 
      (w.email && emp.email && w.email.toLowerCase() === emp.email.toLowerCase()) ||
      (w.employee_name && emp.full_name && w.employee_name.toLowerCase() === emp.full_name.toLowerCase())
    );
    const totalEwa = empWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const count = empWithdrawals.length;
    const sub = count * EWA_SUBSIDY_FEE_PER_TX;
    const base = Number(emp.base_salary || 0);
    const net = Math.max(0, base - totalEwa);

    totalEwaAll += totalEwa;
    totalSubsidyAll += sub;

    text += `${emp.full_name} | ${formatRupiah(base)} | ${formatRupiah(totalEwa)} | ${formatRupiah(sub)} | ${formatRupiah(net)}\n`;
  });

  text += `--------------------------------------------------------------------------------\n`;
  text += `TOTAL POTONGAN EWA DARI KARYAWAN : ${formatRupiah(totalEwaAll)}\n`;
  text += `TOTAL SUBSIDI DITANGGUNG KANTOR   : ${formatRupiah(totalSubsidyAll)} (0 Potong Gaji)\n`;
  text += `--------------------------------------------------------------------------------\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Rekap payroll berhasil disalin ke clipboard!', 'success');
  }).catch(() => {
    showToast('Gagal menyalin ke clipboard', 'error');
  });
}

// -------------------------------------------------------------------
// 7. Helpers & Toast
// -------------------------------------------------------------------
function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `
    <span class="material-symbols-rounded" style="font-size: 18px;">${iconName}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// -------------------------------------------------------------------
// 8. Edukasi Video Management
// -------------------------------------------------------------------
async function loadEdukasiVideos() {
  const grid = document.getElementById('edukasiVideoGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="table-empty" style="padding:40px;text-align:center;color:var(--text-muted);">Memuat video edukasi...</div>';

  try {
    const { data, error } = await supabaseClient
      .from('edukasi_videos')
      .select('*')
      .order('urutan', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    allEdukasiVideos = data || [];
    renderEdukasiGrid(allEdukasiVideos);
  } catch (err) {
    console.error('loadEdukasiVideos error:', err);
    grid.innerHTML = `<div class="table-empty" style="padding:40px;text-align:center;color:var(--danger);">Gagal memuat: ${escapeHtml(err.message)}<br><small>Pastikan tabel edukasi_videos sudah dibuat di Supabase (jalankan supabase/edukasi_videos.sql)</small></div>`;
  }
}

let detectedVideoDuration = '00:00';
let detectedThumbnailBase64 = null;
let customThumbnailBase64 = null;
let editThumbnailBase64 = null;

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h.toString().padStart(2, '0')}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Convert dataURL to Blob untuk upload Supabase Storage
function base64ToBlob(base64) {
  if (!base64 || !base64.includes(';base64,')) return null;
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// Resize image file ke 16:9 480x270 JPEG Base64
function fileToBase64Thumbnail(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Tangkap frame awal video MP4 secara presisi & dapatkan durasi
function handleVideoFileSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  detectedVideoDuration = '00:00';
  detectedThumbnailBase64 = null;
  customThumbnailBase64 = null;

  const previewImg = document.getElementById('videoThumbnailPreview');
  const metaWrap = document.getElementById('videoAutoMetaWrap');
  const durationTextEl = document.getElementById('videoDurationText');

  if (metaWrap) metaWrap.style.display = 'block';
  if (durationTextEl) durationTextEl.textContent = 'Mendeteksi...';

  const url = URL.createObjectURL(file);
  const tempVideo = document.createElement('video');
  tempVideo.style.position = 'fixed';
  tempVideo.style.bottom = '-9999px';
  tempVideo.style.left = '-9999px';
  tempVideo.style.width = '320px';
  tempVideo.style.height = '180px';
  tempVideo.style.opacity = '0';
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.preload = 'auto';
  tempVideo.src = url;
  document.body.appendChild(tempVideo);

  let captured = false;
  const doCapture = () => {
    if (captured) return;
    captured = true;
    try {
      detectedVideoDuration = formatDuration(tempVideo.duration);
      if (durationTextEl) durationTextEl.textContent = detectedVideoDuration;

      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      detectedThumbnailBase64 = base64;
      if (previewImg) previewImg.src = base64;
    } catch (e) {
      console.warn('Gagal capture canvas video:', e);
    } finally {
      URL.revokeObjectURL(url);
      tempVideo.remove();
    }
  };

  tempVideo.onloadedmetadata = () => {
    detectedVideoDuration = formatDuration(tempVideo.duration);
    if (durationTextEl) durationTextEl.textContent = detectedVideoDuration;
    tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
  };

  tempVideo.onseeked = () => {
    setTimeout(doCapture, 150);
  };

  // Timeout fallback
  setTimeout(() => {
    if (!captured) doCapture();
  }, 4000);
}

// Handle jika admin memilih custom thumbnail foto
function handleCustomThumbnailSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  fileToBase64Thumbnail(file, (base64) => {
    customThumbnailBase64 = base64;
    const previewImg = document.getElementById('videoThumbnailPreview');
    const metaWrap = document.getElementById('videoAutoMetaWrap');
    if (previewImg) previewImg.src = base64;
    if (metaWrap) metaWrap.style.display = 'block';
  });
}

function renderEdukasiGrid(list) {
  const grid = document.getElementById('edukasiVideoGrid');
  if (!grid) return;

  if (!list || list.length === 0) {
    grid.innerHTML = `
      <div style="padding:60px 20px; text-align:center; color:var(--text-muted); width:100%;">
        <span class="material-symbols-rounded" style="font-size:48px; display:block; margin-bottom:12px; opacity:0.4;">video_library</span>
        <div style="font-size:1rem; font-weight:600; margin-bottom:6px;">Belum Ada Video</div>
        <div style="font-size:0.85rem;">Klik tombol "+ Upload Video" untuk menambahkan video edukasi pertama.</div>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(v => {
    const previewBtn = v.video_url
      ? `<a href="${escapeHtml(v.video_url)}" target="_blank" class="btn btn-secondary btn-sm" title="Tonton Video">
           <span class="material-symbols-rounded" style="font-size:15px;">play_circle</span>
           <span>Tonton</span>
         </a>`
      : `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.4;cursor:not-allowed;">
           <span class="material-symbols-rounded" style="font-size:15px;">videocam_off</span>
           <span>No URL</span>
         </button>`;

    const thumbHtml = v.thumbnail_url
      ? `<img src="${v.thumbnail_url}" alt="${escapeHtml(v.judul)}" class="video-card-thumb-img" loading="lazy">`
      : `<div class="video-card-thumb-fallback">
           <span class="material-symbols-rounded" style="font-size:38px;color:rgba(255,255,255,0.85);">play_circle</span>
         </div>`;

    return `
      <div class="video-card">
        <!-- Thumbnail 16:9 di sebelah kiri (YouTube Style) -->
        <div class="video-card-thumb">
          ${thumbHtml}
          <div class="video-card-durasi">${escapeHtml(v.durasi || '00:00')}</div>
        </div>

        <!-- Metadata di sebelah kanan (YouTube Style) -->
        <div class="video-card-body">
          <div class="video-card-title">${escapeHtml(v.judul)}</div>
          
          <div class="video-card-subinfo">Cashper Edukasi â€¢ Keuangan</div>

          <div class="video-channel-row">
            <div class="video-channel-avatar">C</div>
            <span class="video-channel-name">Cashper Official</span>
          </div>

          ${v.deskripsi ? `<div class="video-card-desc">${escapeHtml(v.deskripsi)}</div>` : ''}

          <div style="display:flex;gap:8px;margin-top:auto;padding-top:10px;flex-wrap:wrap;">
            ${previewBtn}
            <button class="btn btn-secondary btn-sm" onclick="openEditVideoModal('${v.id}')">
              <span class="material-symbols-rounded" style="font-size:15px;">edit</span>
              <span>Edit</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteEdukasiVideo('${v.id}', '${escapeHtml(v.storage_path || '')}', '${escapeHtml(v.thumbnail_url || '')}')" title="Hapus Video">
              <span class="material-symbols-rounded" style="font-size:15px;">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddVideoModal() {
  document.getElementById('addVideoForm').reset();
  detectedVideoDuration = '00:00';
  detectedThumbnailBase64 = null;
  customThumbnailBase64 = null;
  const metaWrap = document.getElementById('videoAutoMetaWrap');
  if (metaWrap) metaWrap.style.display = 'none';
  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('uploadProgressBar').style.width = '0%';
  document.getElementById('addVideoModal').classList.add('show');
}

async function handleUploadVideo(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitVideo');
  const btnText = document.getElementById('textSubmitVideo');

  const judul = document.getElementById('videoJudul').value.trim();
  const deskripsi = document.getElementById('videoDeskripsi').value.trim();
  const urutan = parseInt(document.getElementById('videoUrutan').value || '0', 10);
  const fileInput = document.getElementById('videoFile');
  const file = fileInput.files[0];

  if (!file) { showToast('Pilih file video MP4 terlebih dahulu', 'error'); return; }

  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Mengunggah...';

  document.getElementById('uploadProgressWrap').style.display = 'block';
  const progressBar = document.getElementById('uploadProgressBar');
  const progressLabel = document.getElementById('uploadProgressLabel');

  try {
    const timestamp = Date.now();
    const safeName = judul.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40);
    const videoExt = file.name.split('.').pop() || 'mp4';
    const storagePath = `videos/${safeName}_${timestamp}.${videoExt}`;

    let fakeProgress = 10;
    const progressInterval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 12, 80);
      progressBar.style.width = fakeProgress + '%';
      progressLabel.textContent = `Mengunggah video MP4... ${Math.round(fakeProgress)}%`;
    }, 400);

    // 1. Upload Video MP4 ke Supabase Storage
    const { error: storageError } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'video/mp4',
        upsert: false
      });

    clearInterval(progressInterval);
    if (storageError) throw new Error('Upload video gagal: ' + storageError.message);

    progressBar.style.width = '85%';
    progressLabel.textContent = 'Menyiapkan thumbnail...';

    // 2. Dapatkan public URL video
    const { data: urlData } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    const videoUrl = urlData?.publicUrl || null;

    // 3. Simpan Thumbnail (Prioritaskan Storage, fallback ke Base64 Data URL)
    const activeThumbnailBase64 = customThumbnailBase64 || detectedThumbnailBase64;
    let finalThumbnailUrl = activeThumbnailBase64; // Default fallback langsung base64 jika storage ditolak

    if (activeThumbnailBase64) {
      try {
        const thumbBlob = base64ToBlob(activeThumbnailBase64);
        if (thumbBlob) {
          const thumbPath = `thumbnails/${safeName}_${timestamp}.jpg`;
          const { error: thumbErr } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(thumbPath, thumbBlob, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!thumbErr) {
            const { data: thumbUrlData } = supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(thumbPath);
            if (thumbUrlData?.publicUrl) {
              finalThumbnailUrl = thumbUrlData.publicUrl;
            }
          }
        }
      } catch (tErr) {
        console.warn('Storage thumbnail warning:', tErr);
      }
    }

    progressBar.style.width = '95%';
    progressLabel.textContent = 'Mempublikasikan ke pengguna...';

    // 4. Simpan ke tabel edukasi_videos (Auto-published!)
    const { error: insertError } = await supabaseClient
      .from('edukasi_videos')
      .insert({
        judul,
        deskripsi,
        kategori: 'Edukasi',
        warna_badge: '#6A1B9A',
        durasi: detectedVideoDuration || '00:00',
        urutan,
        storage_path: storagePath,
        video_url: videoUrl,
        thumbnail_url: finalThumbnailUrl,
        is_published: true
      });

    if (insertError) throw insertError;

    progressBar.style.width = '100%';
    progressLabel.textContent = 'Selesai!';

    showToast(`Video "${judul}" berhasil diupload dan dipublikasikan!`, 'success');
    closeModal('addVideoModal');
    loadEdukasiVideos();

  } catch (err) {
    console.error('handleUploadVideo error:', err);
    showToast(err.message || 'Gagal mengupload video', 'error');
    progressLabel.textContent = 'Upload gagal.';
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Upload & Publikasikan';
  }
}

function openEditVideoModal(videoId) {
  const v = allEdukasiVideos.find(x => x.id === videoId);
  if (!v) { showToast('Video tidak ditemukan', 'error'); return; }

  editThumbnailBase64 = null;
  document.getElementById('editVideoId').value = v.id;
  document.getElementById('editVideoJudul').value = v.judul || '';
  document.getElementById('editVideoDeskripsi').value = v.deskripsi || '';
  document.getElementById('editVideoUrutan').value = v.urutan ?? 0;
  
  const editThumbInput = document.getElementById('editCustomThumbnail');
  editThumbInput.value = '';
  editThumbInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      fileToBase64Thumbnail(file, (base64) => {
        editThumbnailBase64 = base64;
      });
    }
  };

  document.getElementById('editVideoModal').classList.add('show');
}

async function handleUpdateVideo(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitEditVideo');
  const btnText = document.getElementById('textSubmitEditVideo');

  const id = document.getElementById('editVideoId').value;
  const judul = document.getElementById('editVideoJudul').value.trim();
  const deskripsi = document.getElementById('editVideoDeskripsi').value.trim();
  const urutan = parseInt(document.getElementById('editVideoUrutan').value || '0', 10);

  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Menyimpan...';

  try {
    const updateData = { judul, deskripsi, urutan };

    // Jika admin upload thumbnail baru saat edit
    if (editThumbnailBase64) {
      let finalThumb = editThumbnailBase64;
      try {
        const thumbBlob = base64ToBlob(editThumbnailBase64);
        const timestamp = Date.now();
        const safeName = judul.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40);
        const thumbPath = `thumbnails/${safeName}_${timestamp}.jpg`;
        const { error: thumbErr } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(thumbPath, thumbBlob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!thumbErr) {
          const { data: thumbUrlData } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(thumbPath);
          if (thumbUrlData?.publicUrl) finalThumb = thumbUrlData.publicUrl;
        }
      } catch (e) {
        console.warn('Storage edit warn:', e);
      }
      updateData.thumbnail_url = finalThumb;
    }

    const { error } = await supabaseClient
      .from('edukasi_videos')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    showToast(`Video "${judul}" berhasil diperbarui!`, 'success');
    closeModal('editVideoModal');
    loadEdukasiVideos();
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Simpan Perubahan';
  }
}

async function deleteEdukasiVideo(videoId, storagePath, thumbUrl) {
  if (!confirm('Hapus video ini secara permanen? File video dan datanya akan dihapus.')) return;
  try {
    if (storagePath) {
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
    const { error } = await supabaseClient
      .from('edukasi_videos')
      .delete()
      .eq('id', videoId);
    if (error) throw error;
    showToast('Video berhasil dihapus.', 'success');
    loadEdukasiVideos();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}
