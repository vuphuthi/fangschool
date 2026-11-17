<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref} from 'vue';
import {initProgressDashboard, showLearnerProgress} from './admin-overview.js';
import {createLearnerReport} from './admin-report.js';

const {mode} = defineProps({mode: {type: String, required: true}});
const headings = {
  login: 'Truy cập lớp học', setup: 'Truy cập lớp học', admin: 'Quyền truy cập',
  progress: 'Tiến độ học viên', sources: 'Nguồn học liệu', locked: 'Chưa có quyền vào khóa này',
};
const title = computed(() => headings[mode]);
const isAdminArea = ['admin', 'progress', 'sources'].includes(mode);
const DAY = 86_400_000;
const email = ref('');
const confirmedEmail = ref('');
const code = ref('');
const step = ref('email');
const emailInput = ref(null);
const codeInput = ref(null);
const status = ref('');
const fieldError = ref('');
const statusError = ref(false);
const pending = ref(false);
const cooldown = ref(0);
let cooldownTimer = null;
const theme = ref(document.documentElement.dataset.theme || 'light');
const scopes = {hsk: 'HSK', factory: 'Công xưởng', office: 'Văn phòng'};
const vietnamTime = new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'});
const vietnamDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'});

function report(message = '', error = false) {
  status.value = message;
  statusError.value = error;
}

async function api(path, method = 'GET', data) {
  const response = await fetch('/api/' + path, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
    },
    ...(data === undefined ? {} : {body: JSON.stringify(data)}),
  });
  if (response.status === 419) {
    throw new Error('Phiên trang đã hết hạn. Hãy tải lại trang rồi thử lại.');
  }
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.error || 'Hệ thống đang bận. Vui lòng thử lại.'), {status: response.status});
  }
  return result;
}

async function run(action) {
  if (pending.value) return;
  pending.value = true;
  report();
  try {
    await action();
  } catch (error) {
    report(error instanceof TypeError ? 'Không kết nối được với FangSchool. Vui lòng thử lại.' : error.message, true);
  } finally {
    pending.value = false;
  }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  try { localStorage.setItem('fangschool-access-theme', theme.value); } catch {}
}

// ----- Đăng nhập -----
const maskedEmail = computed(() => {
  const [name, domain] = confirmedEmail.value.split('@');
  return name ? name.slice(0, 2) + '•••@' + domain : '';
});

function startCooldown(seconds = 60) {
  cooldown.value = seconds;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, cooldown.value - 1);
    if (!cooldown.value) clearInterval(cooldownTimer);
  }, 1000);
}

async function requestCode() {
  const address = email.value.trim();
  fieldError.value = !address ? 'Vui lòng nhập địa chỉ email.' :
    address.length > 254 || emailInput.value.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
      ? 'Email chưa đúng định dạng. Ví dụ bạn có thể nhập ten@example.com.' : '';
  if (fieldError.value) {
    emailInput.value.focus();
    return;
  }

  await run(async () => {
    let result;
    try {
      result = await api('code', 'POST', {email: address});
    } catch (error) {
      if ([400, 403].includes(error.status)) {
        fieldError.value = error.message;
        emailInput.value.focus();
        return;
      }
      throw error;
    }
    confirmedEmail.value = address;
    step.value = 'code';
    startCooldown();
    report(result.message);
    await nextTick();
    codeInput.value?.focus();
  });
}

function resendCode() {
  if (cooldown.value) return;
  return run(async () => {
    const result = await api('code', 'POST', {email: confirmedEmail.value});
    code.value = '';
    startCooldown();
    report(result.message || 'Đã gửi mã mới.');
    codeInput.value?.focus();
  });
}

function verifyCode() {
  return run(async () => {
    const result = await api('verify', 'POST', {email: confirmedEmail.value, code: code.value});
    if (result.admin && location.pathname === '/') location.assign('/admin');
    else location.reload();
  });
}

async function changeEmail() {
  step.value = 'email';
  code.value = '';
  report();
  await nextTick();
  emailInput.value?.focus();
}

function logout() {
  return run(async () => {
    await api('logout', 'POST');
    location.assign('/');
  });
}

// ----- Quyền truy cập -----
const grants = ref([]);
const keyword = ref('');
const groupFilter = ref('all');
const formSection = ref(null);
const now = () => Date.now();
const rightOf = (row, scope) => scope === 'hsk' ? (row.max_level > 0 ? row : null) : row.workplace?.[scope] ?? null;
const isActive = right => Boolean(right && !right.revoked && right.expires_at > now());
const splitTime = time => {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false}).format(time);
  return {date: vietnamDate.format(time), time: parts};
};
const defaultBlock = days => ({on: false, ...splitTime(now() + days * DAY), time: '23:59'});
const form = reactive({email: '', editing: false, error: '', toast: '', maxLevel: 1,
  blocks: {hsk: defaultBlock(30), factory: defaultBlock(30), office: defaultBlock(30)}});
const editingRow = computed(() => grants.value.find(row => row.email === form.email.trim().toLowerCase()) ?? null);

function blockStatus(scope) {
  const right = editingRow.value && rightOf(editingRow.value, scope);
  if (!right) return {label: 'Chưa cấp', k: 'muted', revocable: false};
  if (right.revoked) return {label: 'Đã thu hồi', k: 'bad', revocable: false};
  if (right.expires_at <= now()) return {label: 'Đã hết hạn ' + vietnamTime.format(right.expires_at), k: 'muted', revocable: false};
  return {label: 'Đang mở · hết hạn ' + vietnamTime.format(right.expires_at), k: (right.expires_at - now() < 7 * DAY) ? 'warn' : 'ok', revocable: true};
}
function quick(scope, days) {
  Object.assign(form.blocks[scope], splitTime(now() + days * DAY), {time: '23:59', on: true});
}
function newForm() {
  Object.assign(form, {email: '', editing: false, error: '', toast: '', maxLevel: 1,
    blocks: {hsk: defaultBlock(30), factory: defaultBlock(30), office: defaultBlock(30)}});
}
async function editRow(row) {
  form.email = row.email; form.editing = true; form.error = ''; form.toast = '';
  form.maxLevel = row.max_level || 1;
  for (const scope of Object.keys(scopes)) {
    const right = rightOf(row, scope);
    form.blocks[scope] = isActive(right) ? {on: true, ...splitTime(right.expires_at)} : defaultBlock(30);
  }
  await nextTick();
  formSection.value?.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function saveGrant() {
  const address = form.email.trim();
  form.error = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? 'Nhập email học viên hợp lệ.' :
    !Object.values(form.blocks).some(block => block.on) ? 'Bật ít nhất một nhóm quyền để lưu.' : '';
  if (form.error) return;
  return run(async () => {
    const saved = [];
    for (const [scope, block] of Object.entries(form.blocks)) {
      if (!block.on) continue;
      const expiresAt = Date.parse(block.date + 'T' + block.time + ':00+07:00');
      await api('grants', 'PUT', {email: address, scope, maxLevel: form.maxLevel, expiresAt});
      saved.push(scopes[scope]);
    }
    await refreshGrants();
    form.editing = true;
    form.toast = 'Đã lưu quyền ' + saved.join(', ') + ' cho ' + address + '.';
  });
}
function revoke(scope) {
  const address = form.email.trim();
  if (!confirm('Thu hồi quyền ' + scopes[scope] + ' của ' + address + '?')) return;
  return run(async () => {
    await api('grants', 'DELETE', {email: address, scope});
    await refreshGrants();
    form.blocks[scope].on = false;
    form.toast = 'Đã thu hồi quyền ' + scopes[scope] + '.';
  });
}
async function refreshGrants() {
  grants.value = await api('grants');
}
const stats = computed(() => {
  const rows = grants.value, soon = now() + 7 * DAY;
  const active = scope => rows.filter(row => isActive(rightOf(row, scope))).length;
  return {
    login: rows.filter(row => Object.keys(scopes).some(scope => isActive(rightOf(row, scope)))).length,
    total: rows.length, hsk: active('hsk'), factory: active('factory'), office: active('office'),
    soon: rows.filter(row => Object.keys(scopes).some(scope => {const r = rightOf(row, scope); return isActive(r) && r.expires_at < soon;})).length,
  };
});
const visibleGrants = computed(() => grants.value.filter(row => {
  if (!row.email.toLowerCase().includes(keyword.value.trim().toLowerCase())) return false;
  const any = Object.keys(scopes).some(scope => isActive(rightOf(row, scope)));
  return groupFilter.value === 'all' || (groupFilter.value === 'none' ? !any : isActive(rightOf(row, groupFilter.value)));
}));
function cell(row, scope) {
  const right = rightOf(row, scope);
  if (!right) return {label: '—', k: 'muted', exp: ''};
  if (right.revoked) return {label: 'Thu hồi', k: 'bad', exp: ''};
  if (right.expires_at <= now()) return {label: 'Hết hạn', k: 'muted', exp: vietnamTime.format(right.expires_at)};
  return {label: scope === 'hsk' ? (row.max_level === 1 ? 'HSK 1' : 'HSK 1–' + row.max_level) : 'Đang mở',
    k: right.expires_at - now() < 7 * DAY ? 'warn' : 'ok', exp: 'đến ' + vietnamTime.format(right.expires_at)};
}

// ----- Nguồn học liệu -----
const sources = ref(null);
const sourceFilter = ref('all');
const sourceCourse = ref('');
const selectedSource = ref(null);
const sourceStatus = {ok: ['Đã nhập đủ', 'ok'], partial: ['Thiếu một phần', 'warn'], missing: ['Thiếu tệp', 'bad']};
const sourceCourses = computed(() => [...new Set((sources.value?.sources ?? []).map(row => row.course))]);
const sourceRows = computed(() => (sources.value?.sources ?? []).filter(row =>
  (sourceFilter.value === 'all' || row.status === sourceFilter.value) && (!sourceCourse.value || row.course === sourceCourse.value)));
const detail = computed(() => selectedSource.value ?? sourceRows.value.find(row => row.status !== 'ok') ?? sourceRows.value[0] ?? null);
const courseLink = course => ({'HSK 1': '/?hsk=1', 'HSK 2': '/?hsk=2', 'HSK 3': '/?hsk=3', 'HSK 4': '/?hsk=4', 'HSK 1 bản 3.0': '/?hsk=1&edition=3.0',
  'HSK 2 bản 3.0': '/?hsk=2&edition=3.0', 'Công xưởng': '/?track=factory', 'Văn phòng': '/?track=office'}[course] ?? '/');
const count = value => Number(value ?? 0).toLocaleString('vi-VN');

onMounted(() => {
  document.title = title.value + ' | FangSchool';
  try {
    const saved = localStorage.getItem('fangschool-access-theme');
    if (saved) { theme.value = saved; document.documentElement.dataset.theme = saved; }
  } catch {}
  if (mode === 'admin') void run(refreshGrants);
  if (mode === 'progress') initProgressDashboard(api, createLearnerReport(api));
  if (mode === 'sources') void run(async () => { sources.value = await api('admin/sources'); });
});
onBeforeUnmount(() => clearInterval(cooldownTimer));
</script>

<template>
  <!-- Đăng nhập / chưa cấu hình / bị khóa -->
  <div v-if="!isAdminArea" class="login-shell">
    <aside class="login-art">
      <a href="/" class="login-brand"><span class="login-mark han" aria-hidden="true">方</span><span>Fang<em>School</em></span></a>
      <div class="login-quote">
        <span class="han" lang="zh-CN">学而时习之</span>
        <small>xué ér shí xí zhī · Học rồi thường xuyên ôn luyện</small>
        <p>Ôn từ vựng, ngữ pháp, hội thoại và làm đề HSK 1–4 ngay trên web.</p>
      </div>
      <p class="login-foot">Chỉ email được giáo viên FangSchool cấp quyền mới đăng nhập được.</p>
    </aside>
    <main class="login-main">
      <div class="login-top">
        <button type="button" class="iconbtn" :aria-label="theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'" @click="toggleTheme">
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M20 15a8.5 8.5 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/></svg>
        </button>
      </div>
      <div class="login-card">
        <template v-if="mode === 'login'">
          <div class="login-steps" aria-hidden="true">
            <span class="chip" :class="{off: step !== 'email'}">1 · Email</span><i></i>
            <span class="chip" :class="{off: step !== 'code'}">2 · Mã OTP</span>
          </div>
          <form v-if="step === 'email'" id="email-form" class="login-form" novalidate @submit.prevent="requestCode">
            <div>
              <h1>Truy cập lớp học</h1>
              <p>Nhập email đã được FangSchool cấp quyền để nhận mã xác thực. Không cần mật khẩu.</p>
            </div>
            <label class="lbl" for="email">Email</label>
            <input id="email" ref="emailInput" v-model="email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="tenban@gmail.com" required
              :aria-invalid="fieldError ? 'true' : undefined" aria-describedby="email-error" @input="fieldError = ''">
            <div v-if="fieldError" id="email-error" class="note" data-k="bad" role="alert"><div>{{ fieldError }}</div></div>
            <p v-else id="email-error" class="sr"></p>
            <button type="submit" class="btn primary" :disabled="pending">Gửi mã xác thực</button>
          </form>
          <form v-else class="login-form" @submit.prevent="verifyCode">
            <div>
              <h1>Nhập mã xác thực</h1>
              <p>Mã 6 số đã gửi đến <strong>{{ maskedEmail }}</strong>. Mã có hiệu lực 10 phút và chỉ dùng được một lần.</p>
            </div>
            <label class="lbl" for="otp">Mã xác thực</label>
            <input id="otp" ref="codeInput" v-model="code" class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code"
              maxlength="6" pattern="[0-9]{6}" placeholder="••••••" required>
            <button class="btn primary" :disabled="pending">Xác nhận và vào học</button>
            <div class="wrap">
              <button type="button" class="btn" :disabled="pending" @click="changeEmail">Đổi email</button>
              <button type="button" class="btn" :disabled="pending || cooldown > 0" @click="resendCode">{{ cooldown ? 'Gửi lại mã (' + cooldown + 's)' : 'Gửi lại mã' }}</button>
            </div>
            <p class="login-help">Không thấy email? Kiểm tra mục Spam/Quảng cáo. Mỗi email chỉ được gửi số mã giới hạn mỗi giờ.</p>
          </form>
        </template>
        <template v-else-if="mode === 'locked'">
          <h1>{{ title }}</h1>
          <p>Quay về để học các khóa đã được mở hoặc đổi email.</p>
          <div class="wrap"><a class="btn primary" href="/">Về lớp học</a><button class="btn" @click="logout">Đổi email</button></div>
        </template>
        <template v-else>
          <h1>{{ title }}</h1>
          <div class="note" data-k="warn"><div>Hệ thống gửi mã xác thực đang chờ cấu hình. Quản trị viên cần điền RESEND_API_KEY, FANGSCHOOL_MAIL_FROM và FANGSCHOOL_ADMIN_EMAILS.</div></div>
        </template>
        <div v-if="status" id="status" class="note" :data-k="statusError ? 'bad' : 'ok'" role="status" aria-live="polite"><div>{{ status }}</div></div>
      </div>
    </main>
  </div>

  <!-- Khu quản trị -->
  <div v-else class="admin-shell">
    <aside class="admin-side" aria-label="Khu quản trị">
      <a href="/" class="brand"><span class="brand-mark han" aria-hidden="true">方</span><span>Fang<em>School</em></span></a>
      <div class="nav-label">Quản trị</div>
      <a class="nav" :class="{active: mode === 'admin'}" href="/admin" :aria-current="mode === 'admin' ? 'page' : undefined">Quyền truy cập</a>
      <a class="nav" :class="{active: mode === 'progress'}" href="/admin/progress" :aria-current="mode === 'progress' ? 'page' : undefined">Tiến độ học viên</a>
      <a class="nav" href="/#teacher">Câu hỏi &amp; lượt ôn</a>
      <a class="nav" :class="{active: mode === 'sources'}" href="/admin/sources" :aria-current="mode === 'sources' ? 'page' : undefined">Nguồn học liệu</a>
      <div class="nav-label">Học tập</div>
      <a class="nav" href="/">Về lớp học</a>
      <div class="admin-foot">
        <button type="button" class="iconbtn" aria-label="Đổi giao diện sáng/tối" @click="toggleTheme">◐</button>
        <button type="button" class="btn" @click="logout">Đăng xuất</button>
      </div>
    </aside>
    <main class="admin-main">
      <div v-if="status" id="status" class="note" :data-k="statusError ? 'bad' : 'ok'" role="status" aria-live="polite" style="margin-bottom:16px"><div>{{ status }}</div></div>

      <template v-if="mode === 'admin'">
        <header class="page-head"><div><h1>Quyền truy cập</h1>
          <p>Mỗi email có 3 nhóm quyền độc lập: HSK, Công xưởng, Văn phòng, với hạn riêng theo giờ Việt Nam. Thu hồi nhóm nào chỉ đóng nhóm đó; thay đổi có hiệu lực ngay với phiên đang đăng nhập.</p></div></header>
        <div class="admin-stats">
          <div class="stat"><div><strong>{{ stats.login }} / {{ stats.total }}</strong><small>Email nhận được OTP</small></div></div>
          <div class="stat"><div><strong>{{ stats.hsk }}</strong><small>Quyền HSK còn hạn</small></div></div>
          <div class="stat"><div><strong>{{ stats.factory }}</strong><small>Công xưởng còn hạn</small></div></div>
          <div class="stat"><div><strong>{{ stats.office }}</strong><small>Văn phòng còn hạn</small></div></div>
          <div class="stat"><div><strong>{{ stats.soon }}</strong><small>Hết hạn trong 7 ngày</small></div></div>
        </div>
        <div class="admin-grid">
          <section ref="formSection" class="panel grant-card" aria-labelledby="f-h">
            <div class="row split"><h2 id="f-h">{{ form.editing ? 'Sửa quyền · ' + form.email : 'Cấp quyền cho email mới' }}</h2>
              <button v-if="form.editing" type="button" class="btn" @click="newForm">+ Email mới</button></div>
            <label class="lbl" for="em">Email</label>
            <input id="em" v-model="form.email" type="email" autocomplete="off" placeholder="hocvien@gmail.com" :readonly="form.editing">
            <div v-if="form.error" class="note" data-k="bad" role="alert"><div>{{ form.error }}</div></div>
            <fieldset v-for="(label, scope) in scopes" :key="scope" class="grant-block" :class="{on: form.blocks[scope].on}">
              <legend>{{ label }}</legend>
              <div class="row split">
                <label class="check"><input v-model="form.blocks[scope].on" type="checkbox"> Mở {{ scope === 'hsk' ? 'quyền HSK' : 'chuyên mục ' + label }}</label>
                <span class="badge" :data-k="blockStatus(scope).k">{{ blockStatus(scope).label }}</span>
              </div>
              <template v-if="form.blocks[scope].on">
                <div v-if="scope === 'hsk'" class="radio-seg" role="radiogroup" aria-label="HSK tối đa">
                  <label v-for="level in 4" :key="level"><input v-model.number="form.maxLevel" type="radio" name="max-level" :value="level">HSK {{ level }}</label>
                </div>
                <small v-if="scope === 'hsk'" class="muted">Mở: HSK 1{{ form.maxLevel > 1 ? '–' + form.maxLevel : '' }} (gồm bản 3.0 tương ứng)</small>
                <div class="row grant-dates">
                  <input v-model="form.blocks[scope].date" type="date" :aria-label="'Ngày hết hạn ' + label">
                  <input v-model="form.blocks[scope].time" type="time" :aria-label="'Giờ hết hạn ' + label">
                </div>
                <div class="chips-select">
                  <button v-for="[days, text] in [[7,'+7 ngày'],[30,'+30 ngày'],[90,'+90 ngày'],[365,'+1 năm']]" :key="days" type="button" class="toggle" @click="quick(scope, days)">{{ text }}</button>
                </div>
              </template>
              <button v-if="blockStatus(scope).revocable" type="button" class="btn danger" :disabled="pending" @click="revoke(scope)">Thu hồi {{ label }}</button>
            </fieldset>
            <button type="button" class="btn primary" :disabled="pending" @click="saveGrant">Lưu quyền truy cập</button>
            <div v-if="form.toast" class="note" data-k="ok" role="status"><div>{{ form.toast }}</div></div>
          </section>
          <section class="panel" aria-labelledby="l-h">
            <div class="row split"><h2 id="l-h">Danh sách email</h2>
              <div class="row">
                <label for="q" class="sr">Tìm email</label><input id="q" v-model="keyword" type="search" placeholder="Tìm email…">
                <label for="gf" class="sr">Lọc theo nhóm</label>
                <select id="gf" v-model="groupFilter"><option value="all">Mọi nhóm</option><option value="hsk">Có HSK</option><option value="factory">Có Công xưởng</option><option value="office">Có Văn phòng</option><option value="none">Không còn quyền nào</option></select>
              </div>
            </div>
            <p v-if="!visibleGrants.length">{{ grants.length ? 'Không tìm thấy email phù hợp.' : 'Chưa có email học viên được cấp quyền.' }}</p>
            <div v-else class="table-wrap form-actions">
              <table class="table">
                <thead><tr><th scope="col">Email</th><th scope="col">HSK</th><th scope="col">Công xưởng</th><th scope="col">Văn phòng</th><th scope="col">Nhận OTP</th><th scope="col"><span class="sr">Thao tác</span></th></tr></thead>
                <tbody>
                  <tr v-for="row in visibleGrants" :key="row.email">
                    <td><strong class="email-cell" :title="row.email">{{ row.email }}</strong></td>
                    <td v-for="scope in Object.keys(scopes)" :key="scope"><span class="badge" :data-k="cell(row, scope).k">{{ cell(row, scope).label }}</span><br><small class="muted">{{ cell(row, scope).exp }}</small></td>
                    <td><span class="badge" :data-k="Object.keys(scopes).some(s => isActive(rightOf(row, s))) ? 'ok' : 'bad'">{{ Object.keys(scopes).some(s => isActive(rightOf(row, s))) ? 'Có' : 'Không' }}</span></td>
                    <td><div class="wrap"><button type="button" class="btn" @click="editRow(row)">Sửa</button><button type="button" class="btn" @click="showLearnerProgress(row.email)">Tiến độ</button></div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>

      <template v-else-if="mode === 'progress'">
        <header class="page-head"><div><span class="chip">/admin/progress</span><h1>Tiến độ học viên</h1>
          <p>Ghi nhận cả câu đã hiển thị và đề đã mở, kể cả khi học viên thoát giữa chừng.</p></div>
          <div class="wrap"><button id="export-csv" type="button" class="btn">Xuất CSV</button><button id="reload-overview" type="button" class="btn">Làm mới</button></div></header>
        <p id="overview-status" role="status"></p>
        <div id="overview-stats" class="admin-stats"></div>
        <section class="panel form-actions" aria-labelledby="overview-learners-title">
          <div class="row split"><h2 id="overview-learners-title">Học viên</h2>
            <div class="row overview-filters">
              <label for="overview-hsk" class="sr">Khóa hoặc chuyên mục</label><select id="overview-hsk"><option value="">Mọi khóa &amp; chuyên mục</option><option value="1">HSK 1</option><option value="2">HSK 2</option><option value="3">HSK 3</option><option value="4">HSK 4</option><option value="41">Công xưởng</option><option value="42">Văn phòng</option></select>
              <label for="overview-search" class="sr">Tìm theo email</label><input id="overview-search" type="search" placeholder="Tìm theo email…" autocomplete="off">
            </div></div>
          <div id="overview-learners" class="form-actions"></div>
        </section>
        <section class="panel form-actions" id="learner-report" hidden aria-labelledby="report-title">
          <div class="row split"><div><small class="muted">Báo cáo học viên</small><h2 id="report-title" tabindex="-1">Tiến độ học viên</h2></div><button id="close-report" type="button" class="btn">Đóng</button></div>
          <p id="report-email"></p>
          <div class="wrap report-toolbar"><label for="report-level">Khóa học<select id="report-level"><option value="1">HSK 1</option><option value="2">HSK 2</option><option value="3">HSK 3</option><option value="4">HSK 4</option><option value="31">HSK 1 · 3.0</option><option value="32">HSK 2 · 3.0</option><option value="41">Công xưởng</option><option value="42">Văn phòng</option></select></label><button id="reload-report" type="button" class="btn">Làm mới</button></div>
          <p id="report-status" role="status"></p><div id="report-body"></div>
        </section>
        <section class="panel form-actions" aria-labelledby="overview-title"><h2 id="overview-title">Hoạt động theo khóa học</h2><div id="overview-levels"></div></section>
      </template>

      <template v-else-if="mode === 'sources'">
        <header class="page-head"><div><h1>Nguồn học liệu</h1>
          <p>Học liệu, đề, audio và dữ liệu có trên máy chủ FangSchool; nguồn theo bài hoặc đề, cùng phần còn thiếu.</p></div>
          <span class="chip">Kiểm kê trực tiếp từ thư mục học liệu</span></header>
        <p v-if="!sources && pending">Đang kiểm kê học liệu…</p>
        <template v-if="sources">
          <div class="admin-stats">
            <div class="stat"><div><strong>{{ count(sources.summary.ok) }} / {{ count(sources.summary.total) }}</strong><small>Nguồn đã nhập đủ</small></div></div>
            <div class="stat"><div><strong>{{ count(sources.summary.fromSource) }}</strong><small>Câu/đề từ học liệu</small></div></div>
            <div class="stat"><div><strong>{{ count(sources.summary.added) }}</strong><small>Câu biên soạn bổ sung</small></div></div>
            <div class="stat"><div><strong>{{ count(sources.summary.missingFiles) }}</strong><small>Tệp cần bổ sung</small></div></div>
          </div>
          <div class="admin-grid sources-grid">
            <section class="panel" aria-labelledby="s-h">
              <div class="row split"><h2 id="s-h">Danh sách nguồn</h2>
                <div class="row">
                  <label for="sc" class="sr">Khóa</label><select id="sc" v-model="sourceCourse"><option value="">Mọi khóa</option><option v-for="c in sourceCourses" :key="c" :value="c">{{ c }}</option></select>
                  <div class="segmented" role="tablist" aria-label="Lọc trạng thái">
                    <button v-for="[k, t] in [['all','Tất cả'],['ok','Đủ'],['partial','Thiếu một phần'],['missing','Thiếu']]" :key="k" type="button" class="btn" role="tab" :aria-selected="sourceFilter === k" @click="sourceFilter = k; selectedSource = null">{{ t }}</button>
                  </div>
                </div></div>
              <div class="table-wrap form-actions sources-table">
                <table class="table">
                  <thead><tr><th scope="col">Nguồn</th><th scope="col">Khóa / chuyên mục</th><th scope="col">Loại</th><th scope="col">Trạng thái</th></tr></thead>
                  <tbody>
                    <tr v-for="row in sourceRows" :key="row.id" :class="{current: detail?.id === row.id}">
                      <td><button type="button" class="source-pick" :aria-pressed="detail?.id === row.id" @click="selectedSource = row"><strong class="han">{{ row.name }}</strong><small class="muted">{{ row.where }}</small></button></td>
                      <td>{{ row.course }}</td>
                      <td><span class="chip">{{ row.type }}</span></td>
                      <td><span class="badge" :data-k="sourceStatus[row.status][1]">{{ sourceStatus[row.status][0] }}</span></td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="!sourceRows.length">Không có nguồn nào khớp bộ lọc.</p>
              </div>
            </section>
            <aside v-if="detail" class="panel source-detail" aria-labelledby="d-h">
              <span class="badge" :data-k="sourceStatus[detail.status][1]">{{ sourceStatus[detail.status][0] }}</span>
              <h2 id="d-h" class="han">{{ detail.name }}</h2>
              <small class="muted">{{ detail.course }} · {{ detail.type }} · {{ detail.where }}</small>
              <h3>Tệp và ánh xạ</h3>
              <div v-for="file in detail.files" :key="file.file + file.map" class="kv">
                <div class="grow"><strong>{{ file.file }}</strong><small class="muted">{{ file.map }}</small></div>
                <span class="badge" :data-k="file.ok ? 'ok' : 'bad'">{{ file.ok ? 'Có' : 'Thiếu' }}</span>
              </div>
              <div v-if="detail.need" class="note" data-k="bad"><div><strong>Cần bổ sung</strong><span>{{ detail.need }}</span></div></div>
              <div class="note"><div>Sau khi chép thêm tệp vào thư mục học liệu, tải lại trang để kiểm kê lại. Có thể chạy <code>npm run verify:content</code> để kiểm tra toàn bộ đề và audio.</div></div>
              <a class="btn primary" :href="courseLink(detail.course)">Mở {{ detail.course }}</a>
            </aside>
          </div>
        </template>
      </template>
    </main>
  </div>
</template>
