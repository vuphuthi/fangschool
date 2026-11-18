@extends('emails.layout', ['subjectLine' => $title, 'preheader' => 'Hạn nộp '.$due, 'tag' => 'Bài được giao'])

@section('body')
<h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">{{ $late ? 'Bài giao đã quá hạn' : 'Nhắc nộp bài' }}</h1>
<p style="margin:0 0 18px;color:#2c3f39;font-size:15px;line-height:1.65;">Bạn còn một bài giáo viên giao chưa hoàn thành:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e4f3eb;border-radius:14px;">
 <tr><td style="padding:16px 18px;">
  <strong style="display:block;font-size:17px;color:#0c3a2e;">{{ $title }}</strong>
  <span style="display:block;margin-top:4px;font-size:14px;color:#2c3f39;">{{ $what }}</span>
  <span style="display:block;margin-top:8px;font-size:13.5px;color:{{ $late ? '#a43a30' : '#7a500d' }};font-weight:700;">Hạn nộp {{ $due }} · đã làm {{ $progress }}%</span>
 </td></tr>
</table>
@if ($note)
<p style="margin:16px 0 0;padding:12px 16px;border-left:3px solid #13684c;background:#f4f7f5;color:#2c3f39;font-size:14px;line-height:1.6;"><strong>Lời nhắn của giáo viên:</strong> {{ $note }}</p>
@endif
<p style="margin:22px 0 0;"><a href="{{ $url }}" style="display:inline-block;padding:13px 26px;border-radius:99px;background:#13684c;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">Làm bài ngay →</a></p>
@endsection

@section('footer')
Email này được gửi vì giáo viên FangSchool đã giao bài cho bạn.
@endsection
