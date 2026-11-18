@extends('emails.layout', ['subjectLine' => $subjectLine, 'preheader' => $active.'/'.$total.' học viên có học tuần này', 'tag' => $range])

@section('body')
<h1 style="margin:0 0 16px;font-size:22px;">{{ $heading }}</h1>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
@foreach ($stats as $stat)
 <td style="width:33%;padding:0 4px;">
  <div style="padding:14px;border-radius:14px;background:#f4f7f5;">
   <strong style="display:block;font-size:22px;">{{ $stat[0] }}</strong>
   <span style="font-size:12px;color:#55695f;">{{ $stat[1] }}</span>
  </div>
 </td>
@endforeach
</tr></table>
@if (count($attention))
<h2 style="margin:22px 0 6px;font-size:15px;">Cần chú ý</h2>
@foreach ($attention as $row)
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e1e9e4;"><tr>
 <td style="padding:10px 0;font-size:13.5px;">{{ $row[0] }}</td>
 <td align="right" style="padding:10px 0;font-size:13px;font-weight:700;color:{{ $row[2] }};">{{ $row[1] }}</td>
</tr></table>
@endforeach
@endif
@if (count($assignments))
<h2 style="margin:22px 0 6px;font-size:15px;">Bài giao</h2>
@foreach ($assignments as $item)
<div style="margin:10px 0;">
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
  <td style="font-size:13.5px;">{{ $item['title'] }}</td>
  <td align="right" style="font-size:13.5px;font-weight:700;">{{ $item['done'] }}/{{ $item['targets'] }} đã nộp</td>
 </tr></table>
 <div style="height:7px;border-radius:99px;background:#eef3f0;margin-top:6px;"><div style="width:{{ $item['targets'] ? intdiv(100 * $item['done'], $item['targets']) : 0 }}%;height:7px;border-radius:99px;background:#13684c;"></div></div>
</div>
@endforeach
@endif
<p style="margin:22px 0 0;"><a href="{{ $url }}" style="display:block;text-align:center;padding:13px;border-radius:99px;background:#13684c;color:#ffffff;font-weight:700;text-decoration:none;font-size:14.5px;">{{ $cta }}</a></p>
@endsection

@section('footer')
{{ $footer }}
@endsection
