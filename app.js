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
  loadLoans();
  loadLoansOverview();
});

// -------------------------------------------------------------------
// 1. Supabase Initialization (Silent, No connection banners/tabs)
// -------------------------------------------------------------------
function initSupabase() {
  try {
    const cleanUrl = DEFAULT_CONFIG.url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    supabaseClient = window.supabase.createClient(cleanUrl, DEFAULT_CONFIG.anonKey);
    // Realtime listener jika ada pengajuan pinjaman baru dari aplikasi mobile
    try {
      supabaseClient
        .channel('company_loans_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_loans' }, () => {
          loadLoans();
        })
        .subscribe();
    } catch (_) {}
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
    loans: 'Persetujuan & Manajemen Pinjaman Karyawan',
    payroll: 'Rekap Pemotongan Payroll',
    edukasi: 'Manajemen Video Edukasi'
  };

  const navMap = {
    overview: 'navOverview',
    employees: 'navEmployees',
    withdrawals: 'navWithdrawals',
    loans: 'navLoans',
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
  if (sectionId === 'loans') loadLoans();
  if (sectionId === 'payroll') loadPayrollRecap();
  if (sectionId === 'edukasi') loadEdukasiVideos();
  if (sectionId === 'overview') {
    loadEmployees();
    loadWithdrawals();
    loadLoansOverview();
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
          
          <div class="video-card-subinfo">Cashper Edukasi • Keuangan</div>

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

// -------------------------------------------------------------------
// 9. Pinjaman Karyawan Management & HR Approval Workflow
// -------------------------------------------------------------------
const STORAGE_KEY_LOANS = 'cashper_hr_loans_db';

const INITIAL_WEB_LOANS = [];

let allLoans = [];
let currentLoanFilterStatus = 'ALL';
let activeLoanInReviewId = null;

function mapSupabaseLoanToModel(row) {
  return {
    id: row.id,
    employeeName: row.employee_name || 'Surya',
    employeeRole: row.employee_role || 'Staff Operasional',
    baseSalary: Number(row.base_salary || 4000000),
    amount: Number(row.amount || 0),
    tenorMonths: Number(row.tenor_months || 1),
    interestRateMonthly: Number(row.interest_rate_monthly || 0.01),
    totalInterest: Number(row.total_interest || 0),
    totalRepayment: Number(row.total_repayment || 0),
    monthlyInstallment: Number(row.monthly_installment || 0),
    reasonCategory: row.reason_category || 'Kebutuhan Mendesak Awal Bulan',
    notes: row.notes || '-',
    status: row.status || 'PENDING',
    appliedDate: row.applied_date || '-',
    approvedDate: row.approved_date || null,
    rejectionReason: row.rejection_reason || null,
    paymentMethod: row.payment_method || 'PAYROLL_DEDUCTION',
    remainingBalance: Number(row.remaining_balance || 0)
  };
}

function getStoredLoans() {
  const saved = localStorage.getItem(STORAGE_KEY_LOANS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Bersihkan data dummy lama (LOAN-1001, LOAN-0942, LOAN-0870) jika masih tersimpan di browser
      const cleaned = parsed.filter(l => l.id !== 'LOAN-1001' && l.id !== 'LOAN-0942' && l.id !== 'LOAN-0870');
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveStoredLoans(data) {
  allLoans = data;
  localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(data));
  updateLoanStatsAndBadges();
  renderLoansTable(getFilteredLoans());
  loadLoansOverview();
}

function updateLoanStatsAndBadges() {
  const pendingCount = allLoans.filter(l => l.status === 'PENDING').length;
  const approvedCount = allLoans.filter(l => l.status === 'APPROVED').length;
  const totalDisbursed = allLoans
    .filter(l => l.status === 'APPROVED' || l.status === 'PAID_OFF')
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const payrollDeduction = allLoans
    .filter(l => l.status === 'APPROVED' && l.paymentMethod === 'PAYROLL_DEDUCTION')
    .reduce((sum, l) => sum + Number(l.monthlyInstallment || 0), 0);

  // Update Section 6 Stats
  const statPendingEl = document.getElementById('loansStatPending');
  const statApprovedEl = document.getElementById('loansStatApproved');
  const statDisbursedEl = document.getElementById('loansStatTotalDisbursed');
  const statPayrollEl = document.getElementById('loansStatPayrollDeduction');

  if (statPendingEl) statPendingEl.textContent = pendingCount;
  if (statApprovedEl) statApprovedEl.textContent = approvedCount;
  if (statDisbursedEl) statDisbursedEl.textContent = formatRupiah(totalDisbursed);
  if (statPayrollEl) statPayrollEl.textContent = formatRupiah(payrollDeduction);

  // Update counts in filter buttons
  const cAll = document.getElementById('countLoanAll');
  const cPending = document.getElementById('countLoanPending');
  const cApproved = document.getElementById('countLoanApproved');
  const cRejected = document.getElementById('countLoanRejected');
  const cPaid = document.getElementById('countLoanPaid');

  if (cAll) cAll.textContent = allLoans.length;
  if (cPending) cPending.textContent = pendingCount;
  if (cApproved) cApproved.textContent = approvedCount;
  if (cRejected) cRejected.textContent = allLoans.filter(l => l.status === 'REJECTED').length;
  if (cPaid) cPaid.textContent = allLoans.filter(l => l.status === 'PAID_OFF').length;

  // Sidebar badge
  const navBadge = document.getElementById('badgeLoansNav');
  if (navBadge) {
    if (pendingCount > 0) {
      navBadge.style.display = 'inline-block';
      navBadge.textContent = pendingCount;
    } else {
      navBadge.style.display = 'none';
    }
  }
}

async function loadLoans(showFeedback = false) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('company_loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        allLoans = data.map(mapSupabaseLoanToModel);
        localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(allLoans));
        updateLoanStatsAndBadges();
        renderLoansTable(getFilteredLoans());
        loadLoansOverview();
        if (showFeedback) showToast('Data pengajuan pinjaman berhasil diperbarui dari Supabase!', 'success');
        return;
      } else if (error && showFeedback) {
        console.warn('Supabase company_loans error:', error);
        showToast('Tabel company_loans belum ada di Supabase. Jalankan script supabase/company_loans.sql di SQL Editor.', 'error');
      }
    } catch (e) {
      console.warn('Gagal memuat pinjaman dari Supabase:', e);
      if (showFeedback) showToast('Gagal memuat: ' + e.message, 'error');
    }
  }

  allLoans = getStoredLoans();
  updateLoanStatsAndBadges();
  renderLoansTable(getFilteredLoans());
  loadLoansOverview();
}

function getFilteredLoans() {
  const query = (document.getElementById('loanSearchInput')?.value || '').trim().toLowerCase();
  const methodFilter = document.getElementById('loanMethodFilter')?.value || 'ALL';

  return allLoans.filter(l => {
    if (currentLoanFilterStatus !== 'ALL' && l.status !== currentLoanFilterStatus) return false;
    if (methodFilter !== 'ALL' && l.paymentMethod !== methodFilter) return false;
    if (query) {
      const matchId = (l.id || '').toLowerCase().includes(query);
      const matchName = (l.employeeName || '').toLowerCase().includes(query);
      const matchRole = (l.employeeRole || '').toLowerCase().includes(query);
      if (!matchId && !matchName && !matchRole) return false;
    }
    return true;
  });
}

function filterLoans() {
  renderLoansTable(getFilteredLoans());
}

function setLoanStatusFilter(status) {
  currentLoanFilterStatus = status;
  document.querySelectorAll('#sectionLoans .btn-filter').forEach(btn => btn.classList.remove('active'));

  const activeBtnMap = {
    ALL: 'filterLoanAll',
    PENDING: 'filterLoanPending',
    APPROVED: 'filterLoanApproved',
    REJECTED: 'filterLoanRejected',
    PAID_OFF: 'filterLoanPaid'
  };
  const activeBtn = document.getElementById(activeBtnMap[status]);
  if (activeBtn) activeBtn.classList.add('active');

  filterLoans();
}

function renderLoansTable(list) {
  const tbody = document.getElementById('loansTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada pengajuan pinjaman yang cocok.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(l => {
    let statusBadge = '';
    if (l.status === 'PENDING') {
      statusBadge = '<span class="status-tag pending">● Perlu Review</span>';
    } else if (l.status === 'APPROVED') {
      statusBadge = '<span class="status-tag disbursed">✓ Disetujui</span>';
    } else if (l.status === 'REJECTED') {
      statusBadge = '<span class="status-tag rejected">✕ Ditolak</span>';
    } else {
      statusBadge = '<span class="status-tag active">✓ Lunas</span>';
    }

    const methodBadge = l.paymentMethod === 'PAYROLL_DEDUCTION'
      ? '<span class="status-tag payroll">Potong Gaji Otomatis</span>'
      : '<span class="status-tag direct">Cicilan Mandiri</span>';

    let actionCell = '';
    if (l.status === 'PENDING') {
      actionCell = `
        <div style="display: flex; gap: 6px; justify-content: center;">
          <button class="btn btn-primary btn-sm" onclick="openLoanReviewModal('${l.id}')">
            Tinjau & Setujui
          </button>
          <button class="btn btn-danger btn-sm" onclick="openLoanRejectModal('${l.id}')">
            Tolak
          </button>
        </div>
      `;
    } else {
      actionCell = `
        <div style="display: flex; gap: 6px; justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="openLoanSlipModal('${l.id}')">
            Lihat Slip
          </button>
        </div>
      `;
    }

    return `
      <tr>
        <td><code>${escapeHtml(l.id)}</code></td>
        <td>
          <div class="emp-name">${escapeHtml(l.employeeName)}</div>
          <div class="emp-sub">${escapeHtml(l.employeeRole)}</div>
        </td>
        <td class="emp-salary"><strong>${formatRupiah(l.amount)}</strong></td>
        <td>
          <div><strong>${l.tenorMonths} Bulan</strong></div>
          <div class="emp-sub">+${formatRupiah(l.totalInterest)} (Bunga ${(l.tenorMonths * 1.0)}%)</div>
        </td>
        <td>
          <div style="color: var(--success); font-weight: 600;">${formatRupiah(l.monthlyInstallment)}/bln</div>
          <div class="emp-sub">Total: ${formatRupiah(l.totalRepayment)}</div>
        </td>
        <td>${methodBadge}</td>
        <td>
          <div style="max-width: 150px; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(l.reasonCategory + ' - ' + l.notes)}">
            ${escapeHtml(l.reasonCategory)}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td class="emp-sub">${escapeHtml(l.appliedDate)}</td>
        <td style="text-align: center;">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function loadLoansOverview() {
  allLoans = getStoredLoans();
  updateLoanStatsAndBadges();

  const tbody = document.getElementById('overviewLoansBody');
  if (!tbody) return;

  const pendingOrRecent = allLoans.slice(0, 5);
  if (!pendingOrRecent || pendingOrRecent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Belum ada permohonan pinjaman karyawan.</td></tr>';
    return;
  }

  tbody.innerHTML = pendingOrRecent.map(l => {
    let statusBadge = '';
    if (l.status === 'PENDING') {
      statusBadge = '<span class="status-tag pending">● Perlu Review</span>';
    } else if (l.status === 'APPROVED') {
      statusBadge = '<span class="status-tag disbursed">✓ Disetujui</span>';
    } else if (l.status === 'REJECTED') {
      statusBadge = '<span class="status-tag rejected">✕ Ditolak</span>';
    } else {
      statusBadge = '<span class="status-tag active">✓ Lunas</span>';
    }

    const methodLabel = l.paymentMethod === 'PAYROLL_DEDUCTION'
      ? '<span class="status-tag payroll">Potong Gaji</span>'
      : '<span class="status-tag direct">Cicilan Mandiri</span>';

    const actionCell = l.status === 'PENDING'
      ? `<button class="btn btn-primary btn-sm" onclick="navigate('loans'); openLoanReviewModal('${l.id}')">Validasi</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="openLoanSlipModal('${l.id}')">Slip</button>`;

    return `
      <tr>
        <td><code>${escapeHtml(l.id)}</code></td>
        <td><strong>${escapeHtml(l.employeeName)}</strong> <span class="emp-sub">(${escapeHtml(l.employeeRole)})</span></td>
        <td><strong>${formatRupiah(l.amount)}</strong></td>
        <td>${l.tenorMonths} Bln (+${formatRupiah(l.totalInterest)})</td>
        <td style="color: var(--success); font-weight: 600;">${formatRupiah(l.monthlyInstallment)}/bln</td>
        <td>${methodLabel}</td>
        <td>${statusBadge}</td>
        <td style="text-align: center;">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function openLoanReviewModal(loanId) {
  const loan = allLoans.find(l => l.id === loanId);
  if (!loan) return;

  activeLoanInReviewId = loanId;
  const titleEl = document.getElementById('modalReviewLoanTitle');
  if (titleEl) titleEl.textContent = `Validasi Pinjaman ${loan.id} - ${loan.employeeName}`;

  const maxQuota = (loan.baseSalary || 4000000) / 2;
  const bodyEl = document.getElementById('reviewLoanModalBody');

  bodyEl.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
      <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
        <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 8px;">Profil Karyawan</span>
        <div style="font-size: 0.85rem; margin-bottom: 4px;">Nama: <strong>${escapeHtml(loan.employeeName)}</strong></div>
        <div style="font-size: 0.85rem; margin-bottom: 4px;">Jabatan: <strong>${escapeHtml(loan.employeeRole)}</strong></div>
        <div style="font-size: 0.85rem; margin-bottom: 4px;">Gaji Pokok: <strong>${formatRupiah(loan.baseSalary || 4000000)}</strong></div>
        <div style="font-size: 0.85rem; color: #3b82f6;">Maks Plafon (50%): <strong>${formatRupiah(maxQuota)}</strong></div>
      </div>

      <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
        <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 8px;">Rincian Pinjaman</span>
        <div style="font-size: 0.85rem; margin-bottom: 4px;">Pokok Pinjaman: <strong>${formatRupiah(loan.amount)}</strong></div>
        <div style="font-size: 0.85rem; margin-bottom: 4px;">Jangka Waktu: <strong>${loan.tenorMonths} Bulan</strong></div>
        <div style="font-size: 0.85rem; margin-bottom: 4px; color: #bf5ae8;">Suku Bunga Karyawan: <strong>1.0% / bulan flat</strong></div>
        <div style="font-size: 0.85rem;">Total Bunga: <strong>+${formatRupiah(loan.totalInterest)}</strong></div>
      </div>
    </div>

    <div style="background: var(--primary-subtle); border: 1px solid var(--primary); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 0.8rem; font-weight: 700; color: #ffffff;">METODE PELUNASAN:</span>
        <span class="status-tag ${loan.paymentMethod === 'PAYROLL_DEDUCTION' ? 'payroll' : 'direct'}">
          ${loan.paymentMethod === 'PAYROLL_DEDUCTION' ? 'Potong Gaji Otomatis (Tgl 28)' : 'Cicilan Mandiri (VA/QRIS)'}
        </span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px;">
        ${loan.paymentMethod === 'PAYROLL_DEDUCTION'
          ? 'Cicilan sebesar <strong>' + formatRupiah(loan.monthlyInstallment) + '</strong> akan dipotong otomatis langsung pada slip gaji tanggal 28 selama ' + loan.tenorMonths + ' bulan.'
          : 'Karyawan membayar cicilan sebesar <strong>' + formatRupiah(loan.monthlyInstallment) + '</strong> secara mandiri via transfer/QRIS.'}
      </p>
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
        <span style="font-size: 0.88rem; font-weight: 600;">Total Pengembalian: ${formatRupiah(loan.totalRepayment)}</span>
        <span style="font-size: 0.94rem; font-weight: 700; color: var(--success);">Cicilan: ${formatRupiah(loan.monthlyInstallment)}/bln</span>
      </div>
    </div>

    <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
      <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Alasan Pengajuan Mendesak:</span>
      <div style="font-size: 0.86rem; font-weight: 600; color: #ffffff; margin-bottom: 2px;">${escapeHtml(loan.reasonCategory)}</div>
      <div style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">"${escapeHtml(loan.notes)}"</div>
    </div>
  `;

  document.getElementById('reviewLoanModal').classList.add('show');
}

function triggerRejectFromReview() {
  closeModal('reviewLoanModal');
  openLoanRejectModal(activeLoanInReviewId);
}

async function handleApproveLoan() {
  if (!activeLoanInReviewId) return;
  const loan = allLoans.find(l => l.id === activeLoanInReviewId);
  if (!loan) return;

  const approvedDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  loan.status = 'APPROVED';
  loan.approvedDate = approvedDate;

  saveStoredLoans(allLoans);
  closeModal('reviewLoanModal');

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('company_loans')
        .update({
          status: 'APPROVED',
          approved_date: approvedDate
        })
        .eq('id', loan.id);
    } catch (e) {
      console.warn('Gagal update approve di Supabase:', e);
    }
  }

  showToast(`Pinjaman ${loan.id} untuk ${loan.employeeName} senilai ${formatRupiah(loan.amount)} berhasil disetujui & dicairkan!`, 'success');
}

function openLoanRejectModal(loanId) {
  activeLoanInReviewId = loanId;
  const inputEl = document.getElementById('loanRejectReasonInput');
  if (inputEl) inputEl.value = '';
  document.getElementById('rejectLoanModal').classList.add('show');
}

function setRejectReason(reasonText) {
  const inputEl = document.getElementById('loanRejectReasonInput');
  if (inputEl) inputEl.value = reasonText;
}

async function handleConfirmRejectLoan() {
  if (!activeLoanInReviewId) return;
  const loan = allLoans.find(l => l.id === activeLoanInReviewId);
  if (!loan) return;

  const reason = (document.getElementById('loanRejectReasonInput')?.value || '').trim() || 'Tidak memenuhi kualifikasi persetujuan pinjaman saat ini.';
  loan.status = 'REJECTED';
  loan.rejectionReason = reason;

  saveStoredLoans(allLoans);
  closeModal('rejectLoanModal');

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('company_loans')
        .update({
          status: 'REJECTED',
          rejection_reason: reason
        })
        .eq('id', loan.id);
    } catch (e) {
      console.warn('Gagal update reject di Supabase:', e);
    }
  }

  showToast(`Pinjaman ${loan.id} ditolak dengan alasan: ${reason}`, 'error');
}

function openLoanSlipModal(loanId) {
  const loan = allLoans.find(l => l.id === loanId);
  if (!loan) return;

  const area = document.getElementById('slipLoanPrintableArea');
  if (!area) return;

  area.innerHTML = `
    <div style="border: 2px solid #CBD5E1; padding: 24px; border-radius: 8px; background: #ffffff; color: #0F172A;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7C2DB8; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 800; color: #7C2DB8; margin: 0;">PT MEGA FINANSIAL NUSANTARA</h2>
          <p style="font-size: 11px; color: #64748B; margin: 2px 0 0;">Divisi HR & People Operations • Cashper Platform</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; font-weight: 700; color: #7C2DB8; background: #F3E8FF; padding: 3px 8px; border-radius: 4px;">BUKTI PERSETUJUAN PINJAMAN</span>
          <p style="font-size: 12px; font-weight: 700; color: #0F172A; margin: 4px 0 0;">No: ${loan.id}/HRD/2026</p>
        </div>
      </div>

      <div style="font-size: 12px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px; color: #475569;">Fasilitas pinjaman resmi perusahaan telah disetujui kepada:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="width: 160px; padding: 4px 0; color: #64748B;">Nama Karyawan</td>
            <td style="padding: 4px 0; font-weight: 700; color: #0F172A;">: ${escapeHtml(loan.employeeName)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748B;">Jabatan / Divisi</td>
            <td style="padding: 4px 0; font-weight: 700; color: #0F172A;">: ${escapeHtml(loan.employeeRole)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748B;">Gaji Pokok</td>
            <td style="padding: 4px 0; font-weight: 700; color: #0F172A;">: ${formatRupiah(loan.baseSalary || 4000000)}</td>
          </tr>
        </table>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 4px 0; color: #475569;">Pokok Pinjaman</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0F172A;">${formatRupiah(loan.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #475569;">Bunga Standar Karyawan</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #7C2DB8;">1.0% / bulan flat (${loan.tenorMonths} bulan = ${formatRupiah(loan.totalInterest)})</td>
          </tr>
          <tr style="border-top: 1px solid #E2E8F0;">
            <td style="padding: 6px 0; font-weight: 700; color: #0F172A;">Total Pengembalian</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #7C2DB8; font-size: 13px;">${formatRupiah(loan.totalRepayment)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #475569;">Cicilan per Bulan</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 800; color: #10B981; font-size: 13px;">${formatRupiah(loan.monthlyInstallment)} / bulan</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #475569;">Skema Pelunasan</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #2563EB;">
              ${loan.paymentMethod === 'PAYROLL_DEDUCTION' ? 'Potong Gaji Otomatis (Tgl 28)' : 'Cicilan Mandiri (VA/QRIS)'}
            </td>
          </tr>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 28px; text-align: center; font-size: 11px;">
        <div style="width: 180px;">
          <p style="color: #64748B; margin: 0 0 40px;">Penerima Fasilitas,</p>
          <strong style="color: #0F172A; text-decoration: underline;">${escapeHtml(loan.employeeName)}</strong>
          <p style="color: #94A3B8; margin: 2px 0 0;">Karyawan</p>
        </div>

        <div style="width: 180px;">
          <p style="color: #64748B; margin: 0 0 40px;">Disetujui Oleh HRD,</p>
          <strong style="color: #0F172A; text-decoration: underline;">Ratna Dewi, S.Psi</strong>
          <p style="color: #94A3B8; margin: 2px 0 0;">Head of HR & People Ops</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('slipLoanModal').classList.add('show');
}

function simulateNewLoanIncoming() {
  const dummyEmployees = [
    { name: "Dewi Kartika", role: "Digital Marketing Specialist", amount: 1200000, tenor: 2, cat: "Biaya Pendidikan Anak" },
    { name: "Ahmad Dahlan", role: "Staff Gudang & Ekspedisi", amount: 800000, tenor: 1, cat: "Kebutuhan Mendesak Awal Bulan" },
    { name: "Fajar Nugraha", role: "Quality Assurance", amount: 1500000, tenor: 3, cat: "Perbaikan Kendaraan Kerja" }
  ];
  const chosen = dummyEmployees[Math.floor(Math.random() * dummyEmployees.length)];
  const interest = Math.round(chosen.amount * 0.01 * chosen.tenor);
  const total = chosen.amount + interest;
  const installment = Math.round(total / chosen.tenor);

  const nowFormatted = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';

  const newLoan = {
    id: "LOAN-" + Math.floor(1000 + Math.random() * 9000),
    employeeName: chosen.name,
    employeeRole: chosen.role,
    baseSalary: 4000000,
    amount: chosen.amount,
    tenorMonths: chosen.tenor,
    interestRateMonthly: 0.01,
    totalInterest: interest,
    totalRepayment: total,
    monthlyInstallment: installment,
    reasonCategory: chosen.cat,
    notes: "Pengajuan pinjaman masuk melalui aplikasi karyawan Cashper.",
    status: "PENDING",
    appliedDate: nowFormatted,
    approvedDate: null,
    rejectionReason: null,
    paymentMethod: "PAYROLL_DEDUCTION",
    remainingBalance: total
  };

  allLoans.unshift(newLoan);
  saveStoredLoans(allLoans);
  showToast(`Pengajuan baru masuk: ${chosen.name} - ${formatRupiah(chosen.amount)} (${chosen.tenor} bln)!`, 'success');
}

async function clearAllLoans() {
  if (!confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA riwayat pengajuan & transaksi pinjaman karyawan di seluruh akun agar data kembali bersih (reset nol)?')) {
    return;
  }
  try {
    if (supabaseClient) {
      const { error: delErr } = await supabaseClient
        .from('company_loans')
        .delete()
        .neq('id', 'NON_EXISTENT_ID');
      if (delErr) {
        console.warn('Gagal hapus pinjaman di Supabase:', delErr);
      }
    }
    allLoans = [];
    saveStoredLoans(allLoans);
    renderLoans();
    renderPendingLoansOverview();
    updateLoanStats();
    showToast('Semua transaksi pinjaman karyawan berhasil dibersihkan! Limit pinjaman kembali penuh.', 'success');
  } catch (err) {
    showToast('Gagal membersihkan data pinjaman: ' + err.message, 'error');
  }
}
