<script setup>
import {computed, nextTick, onMounted, reactive, ref} from 'vue';

const {mode} = defineProps({mode: {type: String, required: true}});
const headings = {
  login: 'Truy cập lớp học', setup: 'Truy cập lớp học',
  admin: 'Quản lý quyền truy cập', locked: 'Cấp HSK này chưa được cấp quyền',
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
const grant = reactive({email: '', maxLevel: 1, expires: '', editing: false});
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
    location.assign(result.admin ? '/admin' : '/');
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
  Object.assign(grant, {email: '', maxLevel: 1, expires: '', editing: false});
}

function editGrant(row) {
  Object.assign(grant, {
    email: row.email, maxLevel: row.max_level,
    expires: new Date(row.expires_at + 7 * 3_600_000).toISOString().slice(0, 16),
    editing: true,
  });
}

function saveGrant() {
  return run(async () => {
    await api('grants', 'PUT', {
      email: grant.email, maxLevel: grant.maxLevel, expiresAt: Date.parse(grant.expires + '+07:00'),
    });
    await refreshGrants();
    resetGrant();
    report('Đã lưu quyền truy cập.');
  });
}

function revoke(row) {
  if (!confirm('Thu hồi quyền của ' + row.email + '?')) return;
  return run(async () => {
    await api('grants', 'DELETE', {email: row.email});
    await refreshGrants();
    report('Đã thu hồi quyền truy cập.');
  });
}

onMounted(() => {
  document.title = title.value + ' | FangSchool';
  if (mode === 'admin') void run(refreshGrants);
});
</script>

<template>
  <main class="access-card" :class="{'access-admin': mode === 'admin'}">
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

    <template v-else-if="mode === 'admin'">
      <div class="wrap"><a class="btn" href="/">Về lớp học</a><button class="btn" @click="logout">Đăng xuất</button></div>
      <section class="panel">
        <h2>Cấp quyền theo email</h2><p>Cấp đã chọn bao gồm mọi cấp thấp hơn. Giờ hết hạn dùng múi giờ Việt Nam (UTC+7).</p>
        <form class="grant-form" @submit.prevent="saveGrant">
          <label>Email học viên<input v-model="grant.email" type="email" autocomplete="off" :readonly="grant.editing" required></label>
          <label>HSK tối đa
            <select v-model.number="grant.maxLevel"><option v-for="level in 4" :key="level" :value="level">HSK {{ level }}</option></select>
          </label>
          <label>Hết hạn tại Việt Nam<input v-model="grant.expires" type="datetime-local" required></label>
          <button class="btn primary" :disabled="pending">Lưu quyền truy cập</button>
          <button type="button" class="btn" @click="resetGrant">Xóa nội dung form</button>
        </form>
      </section>
      <section class="panel">
        <h2>Danh sách học viên</h2>
        <p v-if="!grants.length">Chưa có email học viên được cấp quyền.</p>
        <article v-for="row in grants" :key="row.email" class="grant-row">
          <div>
            <strong>{{ row.email }}</strong>
            <small>{{ row.max_level === 1 ? 'HSK 1' : 'HSK 1–' + row.max_level }} ·
              {{ row.revoked ? 'Đã thu hồi' : row.expires_at <= Date.now() ? 'Đã hết hạn' : 'Đang hoạt động' }} · {{ vietnamTime.format(row.expires_at) }}</small>
          </div>
          <div class="wrap">
            <button type="button" class="btn" :disabled="pending" @click="editGrant(row)">Sửa / gia hạn</button>
            <button v-if="!row.revoked" type="button" class="btn" :disabled="pending" @click="revoke(row)">Thu hồi</button>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="mode === 'locked'">
      <p>Quay về để học các cấp đã được mở hoặc đổi email.</p>
      <div class="wrap"><a class="btn primary" href="/">Về lớp học</a><button class="btn" @click="logout">Đổi email</button></div>
    </template>
    <p v-else>Hệ thống gửi mã xác thực đang chờ cấu hình.</p>

    <p id="status" role="status" aria-live="polite" :data-error="statusError ? '' : undefined">{{ status }}</p>
  </main>
</template>
