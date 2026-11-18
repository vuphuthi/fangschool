@extends('emails.layout', ['subjectLine' => $subjectLine, 'preheader' => 'Hôm nay bạn chưa học phút nào', 'tag' => 'Nhắc học'])

@section('body')
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
 <td style="width:56px;height:56px;background:#f8efdc;border-radius:16px;text-align:center;vertical-align:middle;color:#7a500d;font-size:24px;font-weight:800;">{{ $streak }}</td>
 <td style="padding-left:14px;">
  <strong style="display:block;font-size:20px;">{{ $streak > 0 ? 'Chuỗi '.$streak.' ngày đang chờ bạn' : 'Hôm nay học một chút nhé' }}</strong>
  <span style="font-size:13px;color:#55695f;">Hôm nay bạn chưa học phút nào</span>
 </td>
</tr></table>
<p style="margin:18px 0 14px;font-size:15px;line-height:1.65;color:#2c3f39;">Chỉ cần <strong>10 phút</strong> trước 23:59 là {{ $streak > 0 ? 'giữ được chuỗi học' : 'bắt đầu một chuỗi mới' }}. Hôm nay có:</p>
@foreach ($items as $item)
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:8px;background:#e4f3eb;border-radius:12px;"><tr>
 <td style="padding:12px 14px;font-size:14px;">{{ $item[0] }}</td>
 <td align="right" style="padding:12px 14px;font-size:14px;font-weight:700;">{{ $item[1] }}</td>
</tr></table>
@endforeach
<p style="margin:20px 0 0;"><a href="{{ $url }}" style="display:block;text-align:center;padding:14px;border-radius:99px;background:#13684c;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">Học 10 phút ngay →</a></p>
@endsection

@section('footer')
Bạn nhận email này vì đã bật “Nhắc khi sắp mất chuỗi”. Đổi giờ nhắc hoặc tắt email trong trang Tiến độ: {{ $prefsUrl }}
@endsection
