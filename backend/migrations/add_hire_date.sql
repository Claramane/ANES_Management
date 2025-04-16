-- 添加入職日期欄位到 users 表
PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- 檢查 hire_date 欄位是否已存在，如果不存在則添加
ALTER TABLE users ADD COLUMN hire_date DATE;

-- 更新每個護理師的入職日期
UPDATE users SET hire_date = '2007-07-16' WHERE username = '12858'; -- 王子夙
UPDATE users SET hire_date = '1997-07-01' WHERE username = '10209'; -- 莊佩慧
UPDATE users SET hire_date = '1998-06-01' WHERE username = '10778'; -- 黃靜玲
UPDATE users SET hire_date = '1997-07-01' WHERE username = '10235'; -- 蔡秀金
UPDATE users SET hire_date = '1997-09-01' WHERE username = '10431'; -- 張慈珮
UPDATE users SET hire_date = '1998-05-02' WHERE username = '10762'; -- 許舒惠
UPDATE users SET hire_date = '1999-07-01' WHERE username = '11120'; -- 何瑩慧
UPDATE users SET hire_date = '2002-08-01' WHERE username = '11848'; -- 林雪美
UPDATE users SET hire_date = '2005-09-05' WHERE username = '12488'; -- 謝珮陵
UPDATE users SET hire_date = '2007-07-09' WHERE username = '12856'; -- 陳稚平
UPDATE users SET hire_date = '2011-01-13' WHERE username = '13721'; -- 葉朝菩
UPDATE users SET hire_date = '2012-11-05' WHERE username = '13955'; -- 李相君
UPDATE users SET hire_date = '2014-02-17' WHERE username = '14219'; -- 顧心如
UPDATE users SET hire_date = '2007-09-01' WHERE username = '12129'; -- 石育菁
UPDATE users SET hire_date = '2016-06-20' WHERE username = '14782'; -- 王姿惠
UPDATE users SET hire_date = '2016-11-14' WHERE username = '15003'; -- 李宥蓁
UPDATE users SET hire_date = '2017-06-19' WHERE username = '15011'; -- 魏凡雅
UPDATE users SET hire_date = '2018-12-14' WHERE username = '15429'; -- 羅雅文
UPDATE users SET hire_date = '2023-07-03' WHERE username = '16495'; -- 周穎昇
UPDATE users SET hire_date = '2023-07-03' WHERE username = '16496'; -- 趙仁傑
UPDATE users SET hire_date = '2023-08-07' WHERE username = '16555'; -- 施瑩瑩
UPDATE users SET hire_date = '2023-08-07' WHERE username = '16556'; -- 葉怡彣
UPDATE users SET hire_date = '2010-02-22' WHERE username = '16844'; -- 邱卉羚
UPDATE users SET hire_date = '2021-12-20' WHERE username = '16143'; -- 張育蓉
UPDATE users SET hire_date = '2021-12-20' WHERE username = '16145'; -- 游佳蓁
UPDATE users SET hire_date = '2022-08-01' WHERE username = '16071'; -- 戴培雅
UPDATE users SET hire_date = '2022-08-01' WHERE username = '16285'; -- 李佳欣
UPDATE users SET hire_date = '2022-09-22' WHERE username = '16345'; -- 王釋璞
UPDATE users SET hire_date = '2022-08-01' WHERE username = '16286'; -- 王欣媚
UPDATE users SET hire_date = '2022-08-01' WHERE username = '16287'; -- 游芷欣
UPDATE users SET hire_date = '2022-08-08' WHERE username = '16290'; -- 林蓁
UPDATE users SET hire_date = '2007-11-02' WHERE username = '12937'; -- 洪玉晶
UPDATE users SET hire_date = '2003-11-04' WHERE username = '12050'; -- 劉宸君
UPDATE users SET hire_date = '2006-06-21' WHERE username = '12627'; -- 蔡惠婷
UPDATE users SET hire_date = '2011-10-21' WHERE username = '12458'; -- 陳聿均
UPDATE users SET hire_date = '2012-08-21' WHERE username = '11922'; -- 李孟亭
UPDATE users SET hire_date = '2019-02-25' WHERE username = '15451'; -- 潘靜怡
UPDATE users SET hire_date = '2023-09-01' WHERE username = '15155'; -- 陳盈蓓
UPDATE users SET hire_date = '1997-07-01' WHERE username = '10210'; -- 郭淑慧

COMMIT;

-- 檢查更新結果
SELECT id, username, full_name, hire_date, role, identity FROM users ORDER BY username; 