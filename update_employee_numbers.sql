-- 更新護理師員工編號
-- 使用方法: 在SQLite命令行中運行 .read update_employee_numbers.sql

-- 開始事務
BEGIN TRANSACTION;

-- 王子夙
UPDATE users SET username = '12858' WHERE full_name = '王子夙';

-- 莊佩慧
UPDATE users SET username = '10209' WHERE full_name = '莊佩慧';

-- 黃靜玲
UPDATE users SET username = '10778' WHERE full_name = '黃靜玲';

-- 蔡秀金
UPDATE users SET username = '10235' WHERE full_name = '蔡秀金';

-- 張慈珮
UPDATE users SET username = '10431' WHERE full_name = '張慈珮';

-- 許舒惠
UPDATE users SET username = '10762' WHERE full_name = '許舒惠';

-- 何瑩慧
UPDATE users SET username = '11120' WHERE full_name = '何瑩慧';

-- 林雪美
UPDATE users SET username = '11848' WHERE full_name = '林雪美';

-- 謝珮陵
UPDATE users SET username = '12488' WHERE full_name = '謝珮陵';

-- 陳稚平
UPDATE users SET username = '12856' WHERE full_name = '陳稚平';

-- 葉朝菩
UPDATE users SET username = '13721' WHERE full_name = '葉朝菩';

-- 李相君
UPDATE users SET username = '13955' WHERE full_name = '李相君';

-- 顧心如
UPDATE users SET username = '14219' WHERE full_name = '顧心如';

-- 石育菁
UPDATE users SET username = '12129' WHERE full_name = '石育菁';

-- 王姿惠
UPDATE users SET username = '14782' WHERE full_name = '王姿惠';

-- 李宥蓁
UPDATE users SET username = '15003' WHERE full_name = '李宥蓁';

-- 魏凡雅
UPDATE users SET username = '15011' WHERE full_name = '魏凡雅';

-- 周穎昇
UPDATE users SET username = '16495' WHERE full_name = '周穎昇';

-- 趙仁傑
UPDATE users SET username = '16496' WHERE full_name = '趙仁傑';

-- 施瑩瑩
UPDATE users SET username = '16555' WHERE full_name = '施瑩瑩';

-- 葉怡彣
UPDATE users SET username = '16556' WHERE full_name = '葉怡彣';

-- 邱卉羚
UPDATE users SET username = '16844' WHERE full_name = '邱卉羚';

-- 羅雅文
UPDATE users SET username = '15429' WHERE full_name = '羅雅文';

-- 王釋璞
UPDATE users SET username = '16345' WHERE full_name = '王釋璞';

-- 游佳蓁
UPDATE users SET username = '16145' WHERE full_name = '游佳蓁';

-- 張育蓉
UPDATE users SET username = '16143' WHERE full_name = '張育蓉';

-- 戴培雅
UPDATE users SET username = '16071' WHERE full_name = '戴培雅';

-- 李佳欣
UPDATE users SET username = '16285' WHERE full_name = '李佳欣';

-- 王欣媚
UPDATE users SET username = '16286' WHERE full_name = '王欣媚';

-- 游芷欣
UPDATE users SET username = '16287' WHERE full_name = '游芷欣';

-- 林蓁
UPDATE users SET username = '16290' WHERE full_name = '林蓁';

-- 洪玉晶
UPDATE users SET username = '12937' WHERE full_name = '洪玉晶';

-- 劉宸君
UPDATE users SET username = '12050' WHERE full_name = '劉宸君';

-- 蔡惠婷
UPDATE users SET username = '12627' WHERE full_name = '蔡惠婷';

-- 陳聿均
UPDATE users SET username = '12458' WHERE full_name = '陳聿均';

-- 李孟亭
UPDATE users SET username = '11922' WHERE full_name = '李孟亭';

-- 潘靜怡
UPDATE users SET username = '15451' WHERE full_name = '潘靜怡';

-- 陳盈蓓
UPDATE users SET username = '15155' WHERE full_name = '陳盈蓓';

-- 郭淑慧
UPDATE users SET username = '10210' WHERE full_name = '郭淑慧';

-- 提交事務
COMMIT;

-- 檢查更新結果
SELECT id, username, full_name, role, identity FROM users ORDER BY username; 