<!doctype html>
<html lang="vi">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <title>{{ $subjectLine ?? 'FangSchool' }}</title>
</head>
<body style="margin:0;padding:0;background:#eef3f0;color:#0f241e;font-family:'Be Vietnam Pro',Arial,sans-serif;">
 <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;" aria-hidden="true">{{ $preheader ?? '' }}</div>
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f0;">
  <tr><td align="center" style="padding:28px 12px;">
   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border:1px solid #e1e9e4;border-radius:20px;overflow:hidden;">
    <tr><td style="padding:20px 30px;background:#0c3a2e;">
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="width:34px;height:34px;background:#d2f4e0;border-radius:11px;text-align:center;vertical-align:middle;color:#0c3a2e;font-size:18px;font-weight:700;">方</td>
      <td style="padding-left:12px;color:#ffffff;font-size:17px;font-weight:800;">Fang<span style="color:#8fdcbc;">School</span></td>
      <td align="right" style="color:#a6cbbb;font-size:12.5px;">{{ $tag ?? '' }}</td>
     </tr></table>
    </td></tr>
    <tr><td style="padding:30px;">
@yield('body')
    </td></tr>
    <tr><td style="padding:16px 30px;background:#f4f7f5;color:#55695f;font-size:12px;line-height:1.6;">
@yield('footer')
    </td></tr>
   </table>
  </td></tr>
 </table>
</body>
</html>
