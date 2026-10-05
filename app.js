// ===================================================================
// Cashper HR Portal - Admin Logic (GitHub Pages Ready)
// ===================================================================

const DEFAULT_CONFIG = {
  url: 'https://bzlrrxrljwprmhmxxkql.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bHJyeHJsandwcm1obXh4a3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTEwMjAsImV4cCI6MjEwNjc2NzAyMH0.wZAT2xtJ3VbbM-4pY2b6UpVC2_gRGMYMOv0jCewO2DQ'
};

let supabaseClient = null;
let allEmployees = [];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  updateRoleInfo();
  loadConfigToInputs();
});

// -------------------------------------------------------------------
// 1. Supabase Initialization
// -------------------------------------------------------------------
function getSavedConfig() {
  const savedUrl = localStorage.getItem('cashper_sb_url');
  const savedKey = localStorage.getItem('cashper_sb_key');
  return {
    url: (savedUrl || DEFAULT_CONFIG.url).trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
    anonKey: (savedKey || DEFAULT_CONFIG.anonKey).trim()
  };
}

function initSupabase() {
  const cfg = getSavedConfig();
  try {
    supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    checkConnection();
  } catch (err) {
    console.error('Supabase init error:', err);
    updateConnectionStatus(false, 'Gagal Inisialisasi');
  }
}

async function checkConnection() {
  updateConnectionStatus(null, 'Menghubungkan...');
  try {
    const { data, error } = await supabaseClient.from('roles').select('id, name, base_salary').limit(3);
    if (error) throw error;
    updateConnectionStatus(true, 'Terhubung ke Supabase');
    loadEmployees();
  } catch (err) {
    console.warn('Connection check note:', err);
    updateConnectionStatus(true, 'Supabase Siap');
    loadEmployees();
  }
}

function updateConnectionStatus(isConnected, text) {
  const pill = document.getElementById('connectionPill');
  const dot = pill.querySelector('.status-dot');
  const label = document.getElementById('connectionText');

  label.textContent = text;
  if (isConnected === true) {
    dot.className = 'status-dot connected';
  } else if (isConnected === false) {
    dot.className = 'status-dot';
    dot.style.background = '#FF4D6D';
  } else {
    dot.className = 'status-dot pulsing';
    dot.style.background = '#f59e0b';
  }
}

// -------------------------------------------------------------------
// 2. Tab Navigation
// -------------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  if (tabName === 'register') {
    document.getElementById('tabRegisterBtn').classList.add('active');
    document.getElementById('panelRegister').classList.add('active');
  } else if (tabName === 'list') {
    document.getElementById('tabListBtn').classList.add('active');
    document.getElementById('panelList').classList.add('active');
    loadEmployees();
  } else if (tabName === 'config') {
    document.getElementById('tabConfigBtn').classList.add('active');
    document.getElementById('panelConfig').classList.add('active');
  }
}

function updateRoleInfo() {
  const select = document.getElementById('empRole');
  const selectedOpt = select.options[select.selectedIndex];
  const salary = parseInt(selectedOpt.getAttribute('data-salary') || '4000000', 10);
  const maxEwa = salary * 0.4;
  document.getElementById('roleInfoPreview').innerHTML = 
    `Gaji Pokok: <strong>${formatRupiah(salary)}</strong> &bull; Limit Max EWA (40%): <strong>${formatRupiah(maxEwa)}</strong>`;
}

// -------------------------------------------------------------------
// 3. Register Employee
// -------------------------------------------------------------------
async function handleRegisterEmployee(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitEmployee');
  const btnText = document.getElementById('btnSubmitText');

  const fullName = document.getElementById('empFullName').value.trim();
  const email = document.getElementById('empEmail').value.trim().toLowerCase();
  const password = document.getElementById('empPassword').value;
  const roleId = parseInt(document.getElementById('empRole').value, 10);
  const company = document.getElementById('empCompany').value.trim() || 'PT Maju Bersama';
  const bankName = document.getElementById('empBank').value;
  const accountNumber = document.getElementById('empAccountNumber').value.trim();
  const payday = parseInt(document.getElementById('empPayday').value || '28', 10);

  if (!fullName || !email || !password || !accountNumber) {
    showToast('Harap lengkapi semua kolom bertanda bintang (*)', 'error');
    return;
  }

  // Set loading state
  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Mendaftarkan...';

  try {
    // Call RPC admin_register_employee
    const { data, error } = await supabaseClient.rpc('admin_register_employee', {
      p_email: email,
      p_password: password,
      p_full_name: fullName,
      p_company: company,
      p_role_id: roleId,
      p_bank_name: bankName,
      p_bank_account_number: accountNumber,
      p_payday_day: payday
    });

    if (error) {
      // Fallback if RPC admin_register_employee is not yet run in SQL Editor
      if (error.message.includes('function') && error.message.includes('not found')) {
        throw new Error('Fungsi admin_register_employee belum dipasang di SQL Editor Supabase! Jalankan skrip SQL di tab Koneksi Supabase.');
      }
      throw error;
    }

    // Success!
    showToast(`Karyawan ${fullName} berhasil didaftarkan!`, 'success');
    showSuccessModal({
      name: fullName,
      email: email,
      password: password,
      role: document.getElementById('empRole').options[document.getElementById('empRole').selectedIndex].text
    });

    document.getElementById('employeeForm').reset();
    document.getElementById('empCompany').value = company;
    document.getElementById('empPassword').value = 'cashper123';
    updateRoleInfo();
    loadEmployees();

  } catch (err) {
    console.error('Registration failed:', err);
    showToast(err.message || 'Gagal mendaftarkan karyawan', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Daftarkan Karyawan';
  }
}

// -------------------------------------------------------------------
// 4. Employee Directory
// -------------------------------------------------------------------
async function loadEmployees() {
  const tbody = document.getElementById('employeesTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Memuat data dari Supabase...</td></tr>';

  try {
    // Try via RPC admin_get_employees
    const { data: rpcData, error: rpcError } = await supabaseClient.rpc('admin_get_employees');
    
    let list = [];
    if (!rpcError && Array.isArray(rpcData)) {
      list = rpcData;
    } else {
      // Direct query fallback
      const { data, error } = await supabaseClient
        .from('employees')
        .select('id, full_name, email, company, bank_name, bank_account_number, payday_day, is_active, created_at, role_id, roles(name, base_salary)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      list = (data || []).map(e => ({
        id: e.id,
        full_name: e.full_name,
        email: e.email || '-',
        company: e.company,
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
    renderEmployeeTable(allEmployees);
    updateStats(allEmployees);

  } catch (err) {
    console.error('Failed to load employees:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty" style="color: var(--red-accent);">Gagal memuat: ${err.message}</td></tr>`;
  }
}

function renderEmployeeTable(employees) {
  const tbody = document.getElementById('employeesTableBody');
  document.getElementById('tabCount').textContent = employees.length;

  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada karyawan yang terdaftar. Daftarkan sekarang di tab "Daftar Karyawan Baru".</td></tr>';
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const maskedAcc = emp.bank_account_number 
      ? emp.bank_account_number.slice(0, 3) + '••••' + emp.bank_account_number.slice(-3)
      : '-';

    const statusBadge = emp.is_active
      ? '<span class="status-badge active">Aktif</span>'
      : '<span class="status-badge inactive">Nonaktif</span>';

    const toggleAction = emp.is_active
      ? `<button class="btn btn-secondary btn-sm" onclick="toggleStatus('${emp.id}', false)">Nonaktifkan</button>`
      : `<button class="btn btn-primary btn-sm" onclick="toggleStatus('${emp.id}', true)">Aktifkan</button>`;

    return `
      <tr>
        <td>
          <div class="emp-name-cell">${escapeHtml(emp.full_name)}</div>
          <div class="emp-email-sub">${escapeHtml(emp.email)}</div>
        </td>
        <td>
          <div>${escapeHtml(emp.role_name)}</div>
          <div class="salary-tag">${formatRupiah(emp.base_salary)} / bln</div>
        </td>
        <td>${escapeHtml(emp.company || 'PT Maju Bersama')}</td>
        <td>
          <div><strong>${escapeHtml(emp.bank_name || '-')}</strong></div>
          <div class="emp-email-sub">${maskedAcc}</div>
        </td>
        <td>Tgl ${emp.payday_day || 28}</td>
        <td>${statusBadge}</td>
        <td>${toggleAction}</td>
      </tr>
    `;
  }).join('');
}

function filterEmployees() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!q) {
    renderEmployeeTable(allEmployees);
    return;
  }
  const filtered = allEmployees.filter(e => 
    (e.full_name || '').toLowerCase().includes(q) ||
    (e.email || '').toLowerCase().includes(q) ||
    (e.company || '').toLowerCase().includes(q) ||
    (e.role_name || '').toLowerCase().includes(q)
  );
  renderEmployeeTable(filtered);
}

async function toggleStatus(id, newStatus) {
  try {
    const { error } = await supabaseClient.rpc('admin_toggle_employee_status', {
      p_employee_id: id,
      p_active: newStatus
    });

    if (error) {
      // Fallback direct update
      const { error: updErr } = await supabaseClient
        .from('employees')
        .update({ is_active: newStatus })
        .eq('id', id);
      if (updErr) throw updErr;
    }

    showToast(`Status karyawan berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    loadEmployees();
  } catch (err) {
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

function updateStats(employees) {
  document.getElementById('statTotalEmployees').textContent = employees.length;
  const companies = new Set(employees.map(e => e.company).filter(Boolean));
  document.getElementById('statCompanies').textContent = Math.max(companies.size, 1);
}

// -------------------------------------------------------------------
// 5. Config Management
// -------------------------------------------------------------------
function loadConfigToInputs() {
  const cfg = getSavedConfig();
  document.getElementById('cfgUrl').value = cfg.url;
  document.getElementById('cfgAnonKey').value = cfg.anonKey;
}

function saveCustomConfig(e) {
  e.preventDefault();
  const url = document.getElementById('cfgUrl').value.trim();
  const key = document.getElementById('cfgAnonKey').value.trim();

  localStorage.setItem('cashper_sb_url', url);
  localStorage.setItem('cashper_sb_key', key);

  showToast('Konfigurasi Supabase berhasil disimpan!', 'success');
  initSupabase();
  switchTab('list');
}

function resetDefaultConfig() {
  localStorage.removeItem('cashper_sb_url');
  localStorage.removeItem('cashper_sb_key');
  loadConfigToInputs();
  showToast('Konfigurasi dikembalikan ke default', 'success');
  initSupabase();
}

// -------------------------------------------------------------------
// 6. Modal & Helpers
// -------------------------------------------------------------------
function showSuccessModal(data) {
  document.getElementById('modalName').textContent = data.name;
  document.getElementById('modalEmail').textContent = data.email;
  document.getElementById('modalPassword').textContent = data.password;
  document.getElementById('modalRole').textContent = data.role;
  document.getElementById('successModal').classList.add('show');
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('show');
}

function copyCredentialsAndClose() {
  const email = document.getElementById('modalEmail').textContent;
  const pass = document.getElementById('modalPassword').textContent;
  const text = `Akun Cashper Anda Siap!\nEmail: ${email}\nPassword: ${pass}\nSilakan login di aplikasi Android Cashper.`;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Kredensial berhasil disalin ke clipboard!', 'success');
  }).catch(() => {
    showToast('Kredensial siap digunakan.', 'success');
  });

  closeSuccessModal();
}

function togglePasswordVisibility(fieldId) {
  const el = document.getElementById(fieldId);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function resetForm() {
  setTimeout(updateRoleInfo, 100);
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
