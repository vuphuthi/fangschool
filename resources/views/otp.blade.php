<!doctype html>
<html lang="vi">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <title>Mã đăng nhập FangSchool</title>
</head>
<body style="margin:0;padding:0;background:#eef3f0;color:#0f241e;font-family:'Be Vietnam Pro',Arial,sans-serif;">
 <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;" aria-hidden="true">Mã đăng nhập của bạn: {{ $code }}. Mã có hiệu lực 10 phút và chỉ dùng được một lần.</div>
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f0;">
  <tr><td align="center" style="padding:28px 12px;">
   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e1e9e4;border-radius:20px;overflow:hidden;">
    <tr><td style="padding:22px 32px;background:#0c3a2e;">
     <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="width:36px;height:36px;background:#d2f4e0;border-radius:11px;text-align:center;vertical-align:middle;color:#0c3a2e;font-size:19px;font-weight:700;">方</td>
      <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Fang<span style="color:#8fdcbc;">School</span></td>
     </tr></table>
    </td></tr>
    <tr><td style="padding:32px;">
     <h1 style="margin:0 0 16px;color:#0f241e;font-size:24px;line-height:1.3;">Mã đăng nhập của bạn</h1>
     <p style="margin:0 0 20px;color:#2c3f39;font-size:15px;line-height:1.65;">Xin chào, bạn vừa yêu cầu đăng nhập FangSchool{!! !empty($email) ? ' bằng email <strong>'.e($email).'</strong>' : '' !!}. Nhập mã dưới đây để tiếp tục:</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center" style="padding:22px 12px;background:#e4f3eb;border:1px solid #d3ecdf;border-radius:16px;">
       <strong style="display:block;font-family:Consolas,'Courier New',monospace;font-size:40px;line-height:1.3;letter-spacing:10px;color:#0c3a2e;white-space:nowrap;">{{ substr($code, 0, 3) }} {{ substr($code, 3) }}</strong>
       <span style="display:block;margin-top:6px;font-size:12px;color:#3f5a50;">Hiệu lực 10 phút · dùng một lần</span>
      </td></tr>
     </table>
     <p style="margin:18px 0 0;color:#2c3f39;font-size:14px;line-height:1.65;">Mã có hiệu lực <strong>10 phút</strong> và chỉ dùng được một lần. Trên điện thoại, chạm giữ vào mã để sao chép.</p>
     <p style="margin:18px 0 0;padding-top:18px;border-top:1px solid #e1e9e4;color:#55695f;font-size:13px;line-height:1.65;">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Không chia sẻ mã cho bất kỳ ai, kể cả người tự xưng là giáo viên.</p>
    </td></tr>
    <tr><td style="padding:16px 32px;background:#f4f7f5;color:#55695f;font-size:12px;line-height:1.6;">FangSchool · Ôn tập tiếng Trung HSK 1–4</td></tr>
   </table>
  </td></tr>
 </table>
</body>
</html>
