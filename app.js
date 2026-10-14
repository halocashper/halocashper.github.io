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
      ? emp.bank_account_number.slice(0, 3) + '••••' + emp.bank_account_number.slice(-3)
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
// 5. Withdrawals Management
// -------------------------------------------------------------------
async function loadWithdrawals() {
  const tbodyFull = document.getElementById('withdrawalsTableBody');
  const tbodyOverview = document.getElementById('overviewWithdrawalsBody');

  tbodyFull.innerHTML = '<tr><td colspan="8" class="table-empty">Memuat transaksi...</td></tr>';
  tbodyOverview.innerHTML = '<tr><td colspan="5" class="table-empty">Memuat transaksi...</td></tr>';

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
        .limit(50);

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
    renderWithdrawalsTable(allWithdrawals);
    renderOverviewWithdrawals(allWithdrawals.slice(0, 5));
    updateOverviewStats();

  } catch (err) {
    console.error('loadWithdrawals error:', err);
    tbodyFull.innerHTML = `<tr><td colspan="8" class="table-empty text-red">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    tbodyOverview.innerHTML = `<tr><td colspan="5" class="table-empty text-red">Gagal memuat transaksi</td></tr>`;
  }
}

function renderWithdrawalsTable(list) {
  const tbody = document.getElementById('withdrawalsTableBody');

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada transaksi pencairan EWA.</td></tr>';
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
        <td><code>${escapeHtml(w.reference_id || w.id.substring(0, 8))}</code></td>
        <td>
          <div class="emp-name">${escapeHtml(w.employee_name || '-')}</div>
          <div class="emp-sub">${escapeHtml(w.email || '-')}</div>
        </td>
        <td class="emp-salary"><strong>${formatRupiah(w.amount)}</strong></td>
        <td>${escapeHtml(w.bank_name || '-')} (${escapeHtml(w.bank_account_masked || '-')})</td>
        <td class="emp-sub">${formatDateTime(w.created_at)}</td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
        <td style="text-align: right;">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function renderOverviewWithdrawals(list) {
  const tbody = document.getElementById('overviewWithdrawalsBody');

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
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Menghitung rekap payroll karyawan...</td></tr>';

  // Make sure both employees and withdrawals are loaded
  if (allEmployees.length === 0) {
    await loadEmployees();
  }
  if (allWithdrawals.length === 0) {
    await loadWithdrawals();
  }

  if (allEmployees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada data karyawan.</td></tr>';
    return;
  }

  let totalDeductionAll = 0;
  let totalNetPayAll = 0;
  let activeEwaCount = 0;

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
    const baseSalary = Number(emp.base_salary || 4000000);
    const netPayday = Math.max(0, baseSalary - totalEwa);

    totalDeductionAll += totalEwa;
    totalNetPayAll += netPayday;
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
        <td><strong class="text-green">${formatRupiah(netPayday)}</strong></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;

  // Update Summary Metrics
  const deductionEl = document.getElementById('payrollTotalDeduction');
  const netPayEl = document.getElementById('payrollTotalNetPay');
  const countEl = document.getElementById('payrollEmployeesWithdrawn');

  if (deductionEl) deductionEl.textContent = formatRupiah(totalDeductionAll);
  if (netPayEl) netPayEl.textContent = formatRupiah(totalNetPayAll);
  if (countEl) countEl.textContent = `${activeEwaCount} Karyawan`;
}

function copyPayrollRecap() {
  if (allEmployees.length === 0) {
    showToast('Tidak ada data payroll untuk disalin', 'error');
    return;
  }

  let text = `REKAP PEMOTONGAN GAJI (PAYROLL DEDUCTION) - CASHPER\n`;
  text += `Periode: Bulan Berjalan\n`;
  text += `------------------------------------------------------------\n`;
  text += `Nama | Gaji Pokok | Total EWA Dicairkan | Sisa Ditransfer Payday\n`;
  text += `------------------------------------------------------------\n`;

  allEmployees.forEach(emp => {
    const empWithdrawals = allWithdrawals.filter(w => 
      (w.email && emp.email && w.email.toLowerCase() === emp.email.toLowerCase()) ||
      (w.employee_name && emp.full_name && w.employee_name.toLowerCase() === emp.full_name.toLowerCase())
    );
    const totalEwa = empWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const base = Number(emp.base_salary || 0);
    const net = Math.max(0, base - totalEwa);
    text += `${emp.full_name} | ${formatRupiah(base)} | ${formatRupiah(totalEwa)} | ${formatRupiah(net)}\n`;
  });

  text += `------------------------------------------------------------\n`;

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
let detectedThumbnailBlob = null;
let customThumbnailBlob = null;

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

// Deteksi durasi dan snapshot frame awal video secara otomatis
function handleVideoFileSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  detectedVideoDuration = '00:00';
  detectedThumbnailBlob = null;
  customThumbnailBlob = null;

  const url = URL.createObjectURL(file);
  const tempVideo = document.createElement('video');
  tempVideo.preload = 'metadata';
  tempVideo.src = url;
  tempVideo.muted = true;
  tempVideo.playsInline = true;

  tempVideo.onloadedmetadata = () => {
    detectedVideoDuration = formatDuration(tempVideo.duration);
    const durationTextEl = document.getElementById('videoDurationText');
    if (durationTextEl) durationTextEl.textContent = detectedVideoDuration;

    // Lompat ke detik ke-1 (atau setengah durasi jika video sangat pendek) untuk ambil snapshot
    tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
  };

  tempVideo.onseeked = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = tempVideo.videoWidth || 640;
      canvas.height = tempVideo.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        detectedThumbnailBlob = blob;
        const previewImg = document.getElementById('videoThumbnailPreview');
        const metaWrap = document.getElementById('videoAutoMetaWrap');
        if (previewImg && blob) {
          previewImg.src = URL.createObjectURL(blob);
        }
        if (metaWrap) metaWrap.style.display = 'block';
      }, 'image/jpeg', 0.88);
    } catch (e) {
      console.warn('Gagal ekstrak frame video:', e);
    }
  };
}

function handleCustomThumbnailSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  customThumbnailBlob = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImg = document.getElementById('videoThumbnailPreview');
    const metaWrap = document.getElementById('videoAutoMetaWrap');
    if (previewImg) previewImg.src = e.target.result;
    if (metaWrap) metaWrap.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function renderEdukasiGrid(list) {
  const grid = document.getElementById('edukasiVideoGrid');
  if (!grid) return;

  if (!list || list.length === 0) {
    grid.innerHTML = `
      <div style="padding:60px 20px; text-align:center; color:var(--text-muted); grid-column: 1 / -1;">
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
      ? `<img src="${escapeHtml(v.thumbnail_url)}" alt="${escapeHtml(v.judul)}" class="video-card-thumb-img" loading="lazy">`
      : `<div class="video-card-thumb-fallback">
           <span class="material-symbols-rounded" style="font-size:42px;color:rgba(255,255,255,0.85);">play_circle</span>
         </div>`;

    return `
      <div class="video-card">
        <div class="video-card-thumb">
          ${thumbHtml}
          <div class="video-card-durasi">${escapeHtml(v.durasi || '00:00')}</div>
        </div>
        <div class="video-card-body">
          <div class="video-card-meta-row">
            <div class="video-channel-avatar">C</div>
            <div style="flex:1; min-width:0;">
              <div class="video-card-title">${escapeHtml(v.judul)}</div>
              <div class="video-card-subinfo">Cashper Edukasi</div>
            </div>
          </div>
          ${v.deskripsi ? `<div class="video-card-desc">${escapeHtml(v.deskripsi)}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
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
  detectedThumbnailBlob = null;
  customThumbnailBlob = null;
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

    // 3. Upload Thumbnail (Custom foto atau auto frame snapshot)
    let thumbnailUrl = null;
    const thumbBlobToUpload = customThumbnailBlob || detectedThumbnailBlob;
    if (thumbBlobToUpload) {
      const thumbPath = `thumbnails/${safeName}_${timestamp}.jpg`;
      const { error: thumbErr } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(thumbPath, thumbBlobToUpload, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (!thumbErr) {
        const { data: thumbUrlData } = supabaseClient.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(thumbPath);
        thumbnailUrl = thumbUrlData?.publicUrl || null;
      } else {
        console.warn('Gagal upload thumbnail:', thumbErr.message);
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
        thumbnail_url: thumbnailUrl,
        is_published: true // Selalu auto-publish ke pengguna!
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

  document.getElementById('editVideoId').value = v.id;
  document.getElementById('editVideoJudul').value = v.judul || '';
  document.getElementById('editVideoDeskripsi').value = v.deskripsi || '';
  document.getElementById('editVideoUrutan').value = v.urutan ?? 0;
  document.getElementById('editCustomThumbnail').value = '';

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
  const thumbInput = document.getElementById('editCustomThumbnail');
  const customThumbFile = thumbInput.files && thumbInput.files[0];

  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Menyimpan...';

  try {
    const updateData = { judul, deskripsi, urutan };

    // Jika admin upload thumbnail baru saat edit
    if (customThumbFile) {
      const timestamp = Date.now();
      const safeName = judul.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40);
      const thumbPath = `thumbnails/${safeName}_${timestamp}.jpg`;
      const { error: thumbErr } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(thumbPath, customThumbFile, {
          contentType: customThumbFile.type || 'image/jpeg',
          upsert: true
        });

      if (!thumbErr) {
        const { data: thumbUrlData } = supabaseClient.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(thumbPath);
        updateData.thumbnail_url = thumbUrlData?.publicUrl || null;
      }
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
