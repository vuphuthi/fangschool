<script setup>
import {computed, nextTick, onMounted, reactive, ref} from 'vue';
import {initProgressDashboard, showLearnerProgress} from './admin-overview.js';
import {createLearnerReport} from './admin-report.js';

const {mode} = defineProps({mode: {type: String, required: true}});
const headings = {
  login: 'Truy cập lớp học', setup: 'Truy cập lớp học',
  admin: 'Quản lý quyền truy cập', progress: 'Tiến độ học viên', locked: 'Chưa có quyền vào khóa này',
};
const title = computed(() => headings[mode]);
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
const grants = ref([]);
const grant = reactive({email: '', scope: 'hsk', maxLevel: 1, expires: '', editing: false});
const scopes = {hsk: 'HSK', factory: 'Công xưởng', office: 'Văn phòng'};
const keyword = ref('');
const matchingGrants = computed(() => grants.value.filter(row => row.email.toLowerCase().includes(keyword.value.trim().toLowerCase())));
function grantItems(row) {
  return {...(row.max_level > 0 ? {hsk: row} : {}), ...row.workplace};
}
const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});

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
    report(result.message);
    await nextTick();
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

async function refreshGrants() {
  grants.value = await api('grants');
}

function resetGrant() {
  Object.assign(grant, {email: '', scope: 'hsk', maxLevel: 1, expires: '', editing: false});
}

function editGrant(row, scope, right) {
  Object.assign(grant, {
    email: row.email, scope, maxLevel: row.max_level || 1,
    expires: new Date(right.expires_at + 7 * 3_600_000).toISOString().slice(0, 16),
    editing: true,
  });
}

function saveGrant() {
  return run(async () => {
    await api('grants', 'PUT', {
      email: grant.email, scope: grant.scope, maxLevel: grant.maxLevel, expiresAt: Date.parse(grant.expires + '+07:00'),
    });
    await refreshGrants();
    resetGrant();
    report('Đã lưu quyền truy cập.');
  });
}

function revoke(row, scope) {
  if (!confirm('Thu hồi quyền ' + scopes[scope] + ' của ' + row.email + '?')) return;
  return run(async () => {
    await api('grants', 'DELETE', {email: row.email, scope});
    await refreshGrants();
    report('Đã thu hồi quyền truy cập.');
  });
}

onMounted(() => {
  document.title = title.value + ' | FangSchool';
  if (mode === 'admin') void run(refreshGrants);
  if (mode === 'progress') initProgressDashboard(api, createLearnerReport(api));
});
</script>

<template>
  <main class="access-card" :class="{'access-admin': ['admin','progress'].includes(mode)}">
    <header><a href="/" class="brand">Fang<em>School</em></a><h1>{{ title }}</h1></header>

    <template v-if="mode === 'login'">
      <p>Nhập email đã được FangSchool cấp quyền để nhận mã xác thực.</p>
      <form v-if="step === 'email'" id="email-form" novalidate @submit.prevent="requestCode">
        <div>
          <label>Email
            <input ref="emailInput" v-model="email" name="email" type="email" autocomplete="email" required
              :aria-invalid="fieldError ? 'true' : undefined" aria-describedby="email-error" @input="fieldError = ''">
          </label>
          <p id="email-error" aria-live="polite">{{ fieldError }}</p>
        </div>
        <button type="submit" class="btn primary" :disabled="pending">Gửi mã xác thực</button>
      </form>
      <form v-else @submit.prevent="verifyCode">
        <label>Mã xác thực
          <input ref="codeInput" v-model="code" name="code" inputmode="numeric" autocomplete="one-time-code"
            maxlength="6" pattern="[0-9]{6}" required>
        </label>
        <div class="wrap">
          <button class="btn primary" :disabled="pending">Xác nhận và vào học</button>
          <button type="button" class="btn" :disabled="pending" @click="changeEmail">Đổi email / gửi lại</button>
        </div>
      </form>
    </template>

    <template v-else-if="mode === 'admin' || mode === 'progress'">
      <nav class="wrap admin-navigation" aria-label="Khu quản trị">
        <a class="btn" :class="{active: mode === 'admin'}" href="/admin" :aria-current="mode === 'admin' ? 'page' : undefined">Cấp quyền</a>
        <a class="btn" :class="{active: mode === 'progress'}" href="/admin/progress" :aria-current="mode === 'progress' ? 'page' : undefined">Tiến độ học viên</a>
        <a class="btn" href="/">Về lớp học</a>
        <button class="btn" @click="logout">Đăng xuất</button>
      </nav>
      <template v-if="mode === 'admin'">
        <section class="panel">
          <h2>Cấp quyền theo email</h2><p>Mỗi nhóm có ngày hết hạn riêng. HSK gồm các cấp thấp hơn. Giờ hiển thị theo Việt Nam (UTC+7).</p>
          <form class="grant-form" @submit.prevent="saveGrant">
            <label>Email học viên<input v-model="grant.email" type="email" autocomplete="off" :readonly="grant.editing" required></label>
            <label>Nhóm quyền
              <select v-model="grant.scope"><option v-for="(label, scope) in scopes" :key="scope" :value="scope">{{ label }}</option></select>
            </label>
            <label v-if="grant.scope === 'hsk'">HSK tối đa
              <select v-model.number="grant.maxLevel"><option v-for="level in 4" :key="level" :value="level">HSK {{ level }}</option></select>
            </label>
            <label>Hết hạn tại Việt Nam<input v-model="grant.expires" type="datetime-local" required></label>
            <button class="btn primary" :disabled="pending">Lưu quyền truy cập</button>
            <button type="button" class="btn" @click="resetGrant">Xóa nội dung form</button>
          </form>
        </section>
        <section class="panel">
          <h2>Danh sách học viên</h2>
          <label class="learner-search">Tìm theo email<input v-model="keyword" type="search" autocomplete="off"></label>
          <p v-if="!matchingGrants.length">{{ grants.length ? 'Không tìm thấy email phù hợp.' : 'Chưa có email học viên được cấp quyền.' }}</p>
          <article v-for="row in matchingGrants" :key="row.email" class="grant-row">
            <div>
              <strong>{{ row.email }}</strong>
              <small v-for="(right, scope) in grantItems(row)" :key="scope">{{ scope === 'hsk'
                ? (row.max_level === 1 ? 'HSK 1' : 'HSK 1–' + row.max_level) : scopes[scope] }} ·
                {{ right.revoked ? 'Đã thu hồi' : right.expires_at <= Date.now() ? 'Đã hết hạn' : 'Đang hoạt động' }} · {{ vietnamTime.format(right.expires_at) }}</small>
            </div>
            <div class="wrap">
              <button type="button" class="btn" @click="showLearnerProgress(row.email)">Xem tiến độ</button>
              <template v-for="(right, scope) in grantItems(row)" :key="scope">
                <button type="button" class="btn" :disabled="pending" @click="editGrant(row, scope, right)">Sửa {{ scopes[scope] }}</button>
                <button v-if="!right.revoked" type="button" class="btn" :disabled="pending" @click="revoke(row, scope)">Thu hồi {{ scopes[scope] }}</button>
              </template>
            </div>
          </article>
        </section>
      </template>
      <template v-else>
        <section class="panel admin-overview" aria-labelledby="overview-title">
         <div class="row split"><h2 id="overview-title">Tổng quan</h2><button id="reload-overview" type="button" class="btn">Làm mới</button></div>
         <p id="overview-status" role="status"></p>
         <div id="overview-stats" class="report-stats"></div>
         <div id="overview-levels" class="admin-levels"></div>
        </section>
        <section class="panel" aria-labelledby="overview-learners-title">
         <h2 id="overview-learners-title">Danh sách học viên</h2>
         <div class="wrap overview-filters"><label class="learner-search" for="overview-search">Tìm theo email<input id="overview-search" type="search" placeholder="Nhập email học viên" autocomplete="off"></label><label for="overview-hsk">Phạm vi cấp quyền<select id="overview-hsk"><option value="">Tất cả</option><option value="1">HSK 1</option><option value="2">HSK 2</option><option value="3">HSK 3</option><option value="4">HSK 4</option><option value="41">Công xưởng</option><option value="42">Văn phòng</option></select></label></div>
         <div id="overview-learners"></div>
        </section>
        <section class="panel" id="learner-report" hidden aria-labelledby="report-title">
         <div class="row split"><h2 id="report-title" tabindex="-1">Tiến độ học viên</h2><button id="close-report" type="button" class="btn">Đóng</button></div>
         <p id="report-email"></p>
         <div class="wrap report-toolbar"><label for="report-level">Khóa học<select id="report-level"><option value="1">HSK 1</option><option value="2">HSK 2</option><option value="3">HSK 3</option><option value="4">HSK 4</option><option value="31">HSK 1 · 3.0</option><option value="32">HSK 2 · 3.0</option><option value="41">Công xưởng</option><option value="42">Văn phòng</option></select></label><button id="reload-report" type="button" class="btn">Làm mới</button></div>
         <p id="report-status" role="status"></p><div id="report-body"></div>
        </section>
      </template>
    </template>

    <template v-else-if="mode === 'locked'">
      <p>Quay về để học các khóa đã được mở hoặc đổi email.</p>
      <div class="wrap"><a class="btn primary" href="/">Về lớp học</a><button class="btn" @click="logout">Đổi email</button></div>
    </template>
    <p v-else>Hệ thống gửi mã xác thực đang chờ cấu hình.</p>

    <p id="status" role="status" aria-live="polite" :data-error="statusError ? '' : undefined">{{ status }}</p>
  </main>
</template>
