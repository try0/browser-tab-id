時間＋ランダム数字（＋autoincrement）でなるべく重複しないIDを生成して、sessionStorageで管理します。

sessionStorageが空  
　→生成  
↓  
window.opener.sessionStorageと被っている  
　→生成  
↓  
BroadcastChannelとlocalStorageで重複チェック　別タブと被っている  
　→生成  
↓  
sessionStorageの値をそのまま使用  

