# FangSchool

Bản chuyển từ FangSchool đang sử dụng (mã nguồn Sites tại commit `c194f3c4782f218d1c67a71a0ba82e3056bcf942`, bản 33) sang Laravel 13.42.0 và Vue 3.5.45. Có thể chạy trên máy riêng. Dự án này sử dụng cơ sở dữ liệu riêng và không tác động đến website hiện tại.

## Thành phần

- Laravel quản lý OTP qua Resend, phiên đăng nhập, quyền theo email, tiến độ và phân quyền khi mở học liệu hoặc audio.
- Vue xây dựng form OTP, quản trị cấp quyền và màn hình tiến độ tại `/admin/progress`. Phần học, câu hỏi và đề thi sử dụng lại JavaScript đã chạy trên FangSchool trong `public/lesson`.
- Học liệu HSK 1–4, HSK 1–2 bản 3.0, Công xưởng, Văn phòng, toàn bộ đề PH và audio của bản 33 nằm tại `storage/app/private/fangschool`. Laravel đọc nội dung qua các route có xác thực.
- Tab Hanban HSK 4 có 12 đề gốc PH1–PH12 từ bộ Nguyên Khôi, 100 câu mỗi đề, có PDF, ảnh trang đề và audio. FangSchool chấm 95 câu có đáp án xác định. Năm câu đặt câu theo ảnh dùng bài mẫu để tự đối chiếu. Tab Tinh giảng có 10 bài luyện biên soạn từ học liệu FangSchool.
- Chức năng biên tập câu hỏi trong màn học giữ cách lưu theo trình duyệt của phiên bản ban đầu. Quyền truy cập và tiến độ học lưu ở cơ sở dữ liệu.
- Bản sao dữ liệu máy chủ được cung cấp riêng. Nếu bạn đã tải gói xuất Laravel, tìm thư mục `FangSchool-DuLieu` bên cạnh mã nguồn và xem `thong-ke.json` để biết số bản ghi có thể phục hồi.

## Chạy bằng Docker Desktop

1. Cài và mở Docker Desktop (chế độ Linux containers). Nếu chạy lệnh trong WSL, bật tích hợp Docker Desktop cho bản Ubuntu đang dùng.
2. Clone repo hoặc giải nén ZIP, mở terminal ở thư mục dự án, rồi chạy:

```bash
docker compose up --build -d --wait
```

Mở [http://localhost:8000](http://localhost:8000). Docker tự cài PHP, dependencies Composer, build Vue, tạo khóa ứng dụng và chạy migration SQLite. Lần đầu cần Internet để tải image và dependencies.

Để đăng nhập bằng OTP, tạo `.env` từ `.env.example` và điền `FANGSCHOOL_ADMIN_EMAILS`, `RESEND_API_KEY` và `FANGSCHOOL_MAIL_FROM`. Có thể làm trước lần chạy đầu. Nếu chỉnh thông số khi Docker đã chạy, chạy lại lệnh trên để áp dụng. Nếu chưa điền, trang sẽ hiển thị trạng thái chờ cấu hình gửi mã.

```powershell
Copy-Item .env.example .env
```

Trong WSL/Linux, dùng `cp .env.example .env`. Nếu cổng 8000 đã được dùng, thêm `FANGSCHOOL_PORT=8001` vào `.env` rồi mở `http://localhost:8001`.

- Xem log bằng `docker compose logs -f app`.
- Dừng bằng `docker compose down`. Dữ liệu SQLite và khóa ứng dụng vẫn nằm trong volume `fangschool-data`. Tùy chọn `down -v` sẽ xóa volume này.
- Docker Compose mặc định phục vụ local và dùng SQLite. Phần cấu hình MySQL bên dưới dành cho setup riêng.

## Chạy local trên WSL hoặc Linux

Cần PHP 8.3–8.5, Composer 2, Node.js 24 LTS hoặc bản Node 22.12 trở lên, cùng các extension Laravel yêu cầu. Với PHP trên Ubuntu/WSL, bật PDO SQLite hoặc PDO MySQL tùy cấu hình. Giải nén project trong filesystem Linux, chẳng hạn dưới `~/MyProject`.

```bash
cp .env.example .env
touch database/database.sqlite
composer install
php artisan key:generate
php artisan migrate
npm ci
npm run build
php artisan serve
```

Trong `.env`, điền `FANGSCHOOL_ADMIN_EMAILS` (các email admin, cách nhau bằng dấu phẩy), `FANGSCHOOL_MAIL_FROM` (địa chỉ thuộc domain đã xác minh trên Resend) và `RESEND_API_KEY`. Mở http://localhost:8000, đăng nhập bằng email admin, rồi truy cập `/admin` để cấp quyền. Khi thay đổi cấu hình mà môi trường từng dùng config cache, chạy `php artisan config:clear`.

`npm run build` cập nhật bundle Vue. Dùng `npm run verify:content` để kiểm tra đề PH, các file nghe và vị trí lưu học liệu.

## Dùng MySQL

Tạo database và user dành riêng cho FangSchool. Trước khi chạy migration, chỉnh `.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=fangschool
DB_USERNAME=fangschool
DB_PASSWORD=replace-with-your-password
```

## Triển khai

1. Trỏ document root tới thư mục `public/`. Toàn bộ `storage/app/private/`, `.env` và project PHP ở ngoài document root. Phục vụ bằng HTTPS.
2. Dùng `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, và đặt `APP_URL` theo địa chỉ triển khai. Nếu dùng proxy kết thúc TLS, cấu hình trusted proxy và chuyển tiếp đúng host/scheme.
3. Cài dependencies bằng Composer, chạy `npm ci && npm run build`, sau đó `php artisan migrate --force`. PHP cần ghi được vào `storage/framework`, `storage/logs` và `bootstrap/cache`. Dùng `php artisan schedule:run` theo lịch chuẩn của Laravel để dọn phiên và OTP hết hạn.
4. Trước khi chuyển `fangschool.site`, thử gửi OTP thật trong môi trường đích, xác nhận giới hạn HSK qua URL trực tiếp, thử lưu tiến độ, nghe MP3 và làm đề trên điện thoại. Sao lưu cơ sở dữ liệu và học liệu trước khi chuyển.

## Luồng dữ liệu

- `grants` lưu quyền HSK, `workplace_grants` lưu quyền Công xưởng và Văn phòng, `learner_progress` lưu snapshot theo email và mã khóa học. Thời hạn và dấu thời gian dùng epoch milliseconds.
- Lệnh nhập ánh xạ bốn bảng tiến độ D1 vào `learner_progress`, giữ nguyên email, mã khóa, snapshot và revision. Bản ghi trùng khóa được giữ lại ở cơ sở dữ liệu đích.
- Dữ liệu HSK lưu dưới dạng JSON trong thư mục học liệu. Giữ ID của câu hỏi/đề khi chỉnh nội dung để lịch sử hiện có vẫn khớp.


## Nhập bản sao máy chủ sau khi chạy migration

Chạy từ thư mục `FangSchool`. Bản sao có dữ liệu học viên, giữ ngoài repo và chỉ dùng khi cần khôi phục.

```bash
php artisan fangschool:import-site-data ../FangSchool-DuLieu/fangschool-backup.sqlite
```

Với Docker Compose, sau khi container đã chạy:

```bash
docker compose cp ../FangSchool-DuLieu/fangschool-backup.sqlite app:/tmp/fangschool-backup.sqlite
docker compose exec app php artisan fangschool:import-site-data /tmp/fangschool-backup.sqlite
docker compose exec app rm /tmp/fangschool-backup.sqlite
```

### Hỏi AI

Cấu hình hai biến sau trong file `.env` của môi trường chạy Laravel hoặc Docker Compose:

```dotenv
CF_AI_ACCOUNT_ID=
CF_AI_API_TOKEN=
```

Dùng API token Cloudflare Workers AI cho đúng tài khoản. Giữ token ở backend. Nếu dùng token đã xuất hiện trong ảnh chụp hoặc đã chia sẻ, hãy thu hồi token đó và dùng token mới.

Chạy `php artisan migrate --force` khi triển khai Laravel trực tiếp. Với Docker Compose, chạy `docker compose up -d --build`. Container tự chạy migration trên volume hiện có. Nếu triển khai có cache cấu hình, tạo lại cache sau khi cập nhật biến môi trường.

Khi đã cấu hình, học viên và admin đăng nhập đều có mục **Hỏi AI** trên menu và nút chat nổi. Lịch sử được lưu theo email trong cơ sở dữ liệu của bản Laravel. Các cuộc chat trên bản Sites cần được xuất và nhập riêng nếu muốn chuyển sang Laravel. Ứng dụng không đặt giới hạn số tin nhắn mỗi ngày. Cloudflare áp dụng hạn mức và phí theo gói của tài khoản.
