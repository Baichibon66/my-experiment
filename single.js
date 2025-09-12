// ========== 获取Prolific PID ==========
function getProlificPID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('PROLIFIC_PID') || 'NO_PID';
}
const prolificPID = getProlificPID();
console.log('Prolific ID:', prolificPID);

const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=CZEQN2PE"; // Completion Code

// ========== さくら（sakura）サーバ設定 ==========
// TODO: 将下方占位URL替换为实际さくら服务器端点
// const SAKURA_SERVER_URL = "https://sakura-server.example.com/single/";
// const CHEAT_REPORT_URL = SAKURA_SERVER_URL + "cheat_report.php";

// ========== 1. パス設定 ==========
const IMAGE_PATH = "formalimages/"; // images folder
const TRIALS_XLSX_PATH = "experiment_data/formal_trials.csv"; // pseudorandom 試行表（順、手がかりの図、桜について）
const OUTPUT_XLSX_NAME = "single_choice_data.csv"; // データ輸出
const PRACTICE_TRIALS_XLSX_PATH = "experiment_data/practice_trials.csv";

// ========== 2. jsPsych全体設定 ==========
const jsPsych = initJsPsych({
  on_finish: function() {
    // 研究2：暂不进行正式数据的网络传输。
    // 重定向由最后的"感谢画面"负责触发。
    console.log('Experiment finished. No data transmission for Study 2 baseline.');
    
    // 数据下载现在在感谢画面的on_finish中处理，避免重复下载
  }
});
jsPsych.data.addProperties({prolificPID: prolificPID});

// Add experiment start date and time
const experimentStartTime = new Date().toISOString();
jsPsych.data.addProperties({experimentStartTime: experimentStartTime});

const globalStyle = `
  body { background-color: black !important; color: white !important; }
  .jspsych-content { color: white !important; }
`;
const style = document.createElement('style');
style.innerHTML = globalStyle;
document.head.appendChild(style);

// ========== 防作弊机制 ==========
let cheatDetected = false;

// ========== 新添加：本地下载CSV数据函数 ==========
function downloadExperimentData() {
  console.log('开始下载实验数据...');
  
  try {
    // 获取所有实验数据
    const allData = jsPsych.data.get();
    console.log('获取到所有数据，共', allData.length, '条记录');
    
    // 过滤掉练习数据，只保留正式实验数据
    const formalData = allData.filter(trial => !trial.is_practice);
    console.log('过滤后的正式实验数据，共', formalData.length, '条记录');
    
    if (formalData.length === 0) {
      console.warn('没有找到正式实验数据，尝试下载所有数据');
      // 如果没有正式数据，下载所有数据
      const csvContent = convertToCSV(allData);
      downloadCSV(csvContent, 'all_experiment_data.csv');
      return;
    }
    
    // 转换为CSV格式
    const csvContent = convertToCSV(formalData);
    console.log('CSV内容长度:', csvContent.length, '字符');
    
    // 执行下载
    downloadCSV(csvContent, OUTPUT_XLSX_NAME);
    
  } catch (error) {
    console.error('下载实验数据时出错:', error);
    // 尝试备用下载方法
    try {
      console.log('尝试备用下载方法...');
      const allData = jsPsych.data.get();
      const csvContent = convertToCSV(allData);
      downloadCSV(csvContent, 'backup_' + OUTPUT_XLSX_NAME);
    } catch (backupError) {
      console.error('备用下载方法也失败了:', backupError);
      alert('数据下载失败，请检查浏览器控制台获取详细信息');
    }
  }
}

// ========== 新增：CSV下载辅助函数 ==========
function downloadCSV(csvContent, filename) {
  console.log('开始下载CSV文件:', filename);
  console.log('CSV内容长度:', csvContent.length);
  
  // 检测浏览器类型
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  
  console.log('浏览器检测 - Chrome:', isChrome, 'Firefox:', isFirefox, 'Safari:', isSafari);
  
  try {
    // 方法1：使用Blob和URL.createObjectURL（推荐方法）
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    console.log('Blob创建成功，大小:', blob.size, 'bytes');
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // 设置链接属性
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // 添加到DOM并触发点击
    document.body.appendChild(link);
    
    // 对于Chrome，需要确保在用户交互上下文中
    if (isChrome) {
      // 使用更兼容的方式
      link.click();
    } else {
      // 其他浏览器
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      link.dispatchEvent(clickEvent);
    }
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('Blob下载方法执行完成');
    return true;
    
  } catch (error) {
    console.error('Blob下载方法失败:', error);
    
    // 方法2：使用data URL（备用方法）
    try {
      console.log('尝试data URL方法...');
      
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const downloadAnchorNode = document.createElement('a');
      
      downloadAnchorNode.href = dataStr;
      downloadAnchorNode.download = filename;
      downloadAnchorNode.style.display = 'none';
      
      document.body.appendChild(downloadAnchorNode);
      
      if (isChrome) {
        downloadAnchorNode.click();
      } else {
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        downloadAnchorNode.dispatchEvent(clickEvent);
      }
      
      setTimeout(() => {
        document.body.removeChild(downloadAnchorNode);
      }, 100);
      
      console.log('data URL方法执行完成');
      return true;
      
    } catch (dataUrlError) {
      console.error('data URL下载方法也失败了:', dataUrlError);
      
      // 方法3：尝试使用window.open（最后的方法）
      try {
        console.log('尝试window.open方法...');
        
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>实验数据下载</title></head>
              <body>
                <h2>实验数据</h2>
                <p>请右键点击下方链接并选择"另存为"来下载数据：</p>
                <a href="data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}" download="${filename}">
                  点击下载 ${filename}
                </a>
                <br><br>
                <button onclick="window.close()">关闭窗口</button>
              </body>
            </html>
          `);
          newWindow.document.close();
          console.log('window.open方法执行完成');
          return true;
        } else {
          throw new Error('无法打开新窗口，可能被浏览器阻止');
        }
      } catch (windowOpenError) {
        console.error('window.open方法也失败了:', windowOpenError);
        throw new Error('所有下载方法都失败了');
      }
    }
  }
}

// ========== 新添加：CSV转换函数 ==========
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  // 获取所有列名
  const headers = Object.keys(data[0]);
  
  // 创建CSV头部
  const csvHeader = headers.join(',');
  
  // 创建CSV数据行
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // 处理包含逗号、引号或换行符的值
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  // 组合头部和数据行
  return [csvHeader, ...csvRows].join('\n');
}

// ========== 注释掉：服务器作弊报告功能 ==========
/*
function reportCheatToServer(eventType, extra = {}) {
  try {
    fetch(CHEAT_REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prolific_pid: prolificPID,
        timestamp: new Date().toISOString(),
        event_type: eventType,
        user_agent: navigator.userAgent,
        experiment_start: experimentStartTime,
        ...extra
      })
    }).catch(() => {});
  } catch (_) {}
}
*/

function abortExperimentDueToCheat(reason) {
  if (cheatDetected) return;
  cheatDetected = true;
  try {
    jsPsych.data.addProperties({ cheatDetected: true, cheatReason: reason });
  } catch (_) {}
  
  // ========== 注释掉：服务器作弊报告 ==========
  // reportCheatToServer('cheat_detected', { reason });
  
  try {
    jsPsych.endExperiment(`
      <div style='font-size: 28px; text-align: center; color: white;'>
        不正行為が検出されたため、実験を中止します。
      </div>
    `);
  } catch (_) {
    // 兜底：直接替换页面
    document.body.innerHTML = "<div style='font-size:28px;text-align:center;color:white;background:black;height:100vh;display:flex;align-items:center;justify-content:center;'>不正行為が検出されたため、実験を中止します。</div>";
  }
}

// 键盘组合检测：F12、Ctrl+U、Ctrl+Shift+I/J/C
window.addEventListener('keydown', function(e) {
  const key = (e.key || '').toUpperCase();
  if (key === 'F12' || (e.ctrlKey && !e.shiftKey && key === 'U') || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(key))) {
    e.preventDefault();
    abortExperimentDueToCheat(`key:${key}`);
  }
}, true);

// 简易DevTools开启检测（尺寸差异法）
let lastDevtoolsState = false;
setInterval(() => {
  if (cheatDetected) return;
  const threshold = 160;
  const devtoolsLike = Math.abs(window.outerWidth - window.innerWidth) > threshold || Math.abs(window.outerHeight - window.innerHeight) > threshold;
  if (devtoolsLike && !lastDevtoolsState) {
    lastDevtoolsState = true;
    abortExperimentDueToCheat('devtools_open');
  }
}, 1000);

// ========== 3. 試行表の読み込み ==========
let practiceTrials = [];
let trials = [];
let timeline = [];
let totalScore = 0;
let practiceScore = 0;

Papa.parse(PRACTICE_TRIALS_XLSX_PATH, {
  download: true,
  header: true,
  complete: function(practiceResults) {
    practiceTrials = practiceResults.data;
    Papa.parse(TRIALS_XLSX_PATH, {
      download: true,
      header: true,
      complete: function(results) {
        trials = results.data;
        // 假设trials已经有120个元素
        const BLOCK_SIZE = 30;
        const BLOCK_NUM = 4;
        const UP_IMAGES = ['1', '2'];

        for (let block = 0; block < BLOCK_NUM; block++) {
          // 生成15个'1'和15个'2'的上方图片分配
          let upImages = Array(15).fill('1').concat(Array(15).fill('2'));
          // 随机打乱
          for (let i = upImages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [upImages[i], upImages[j]] = [upImages[j], upImages[i]];
          }
          // 分配到trials
          for (let i = 0; i < BLOCK_SIZE; i++) {
            const trialIndex = block * BLOCK_SIZE + i;
            trials[trialIndex].Up_Image = upImages[i];
            trials[trialIndex].Down_Image = upImages[i] === '1' ? '2' : '1';
          }
        }

        for (let block = 0; block < BLOCK_NUM; block++) {
          // 生成21个'1'和9个'2'的正确线索图片分配
          let correctImages = Array(9).fill('1').concat(Array(21).fill('2'));
          // 随机打乱
          for (let i = correctImages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [correctImages[i], correctImages[j]] = [correctImages[j], correctImages[i]];
          }
          // 分配到trials
          for (let i = 0; i < BLOCK_SIZE; i++) {
            const trialIndex = block * BLOCK_SIZE + i;
            trials[trialIndex].Correct_Image = correctImages[i];
          }
        }
        startExperiment();
      }
    });
  }
});

function startExperiment() {
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>こちらは練習のセクションです。</p>
        <p>練習に入る前に、必ず本研究のProlificページに記載された説明をよくお読みください。</p>
        <p>このセクションを通じて、実験の流れに慣れてください。</p>
        <p>スペースキーを押して練習を開始してください。</p>
        <!-- TODO: 在这里添加具体的练习指导语 -->
      </div>
    `,
    choices: [' '],
    css_classes: ['jspsych-content'],
  });

  // ========== 新添加：图片说明界面 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='display: flex; justify-content: center; align-items: center; height: 100vh;'>
        <div style='text-align: center;'>
          <div style='display: flex; justify-content: space-around; width: 600px; margin-bottom: 40px;'>
            <div>
              <img src='${IMAGE_PATH}1.png' style='height: 120px; margin-bottom: 20px;'>
              <div style='font-size: 24px; color: white;'>图片1</div>
            </div>
            <div>
              <img src='${IMAGE_PATH}2.png' style='height: 120px; margin-bottom: 20px;'>
              <div style='font-size: 24px; color: white;'>图片2</div>
            </div>
          </div>
          <div style='font-size: 20px; color: #ffd966; margin-top: 40px;'>
            按空格键切换至下一界面
          </div>
        </div>
      </div>
    `,
    choices: [' '],
    trial_duration: null, // 无时间限制
    css_classes: ['jspsych-content'],
  });

  // ========== 新增：练习环节 (6个试次) ==========
  // 使用正式实验的前6个试次数据作为练习
  const practiceTrialsToUse = practiceTrials.slice(0, 6);

  for (let i = 0; i < practiceTrialsToUse.length; i++) {
    const trial = practiceTrialsToUse[i];
    // ====== 被験者試行 ======
    // 画面3：刺激画面 (练习)
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='position: relative; width: 100vw; height: 100vh;'>
          <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
            <svg width='120' height='120'>
              <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
              <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
            </svg>
          </div>
          <img src='${IMAGE_PATH + trial.Up_Image + ".png"}' style='position: absolute; left: 50%; top: 20%; transform: translate(-50%, 0); height: 120px;'>
          <img src='${IMAGE_PATH + trial.Down_Image + ".png"}' style='position: absolute; left: 50%; bottom: 20%; transform: translate(-50%, 0); height: 120px;'>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: Math.floor(Math.random() * 151) + 1000,
      css_classes: ['jspsych-content'],
      data: { is_practice: true } // 标记为练习试次
    });
    // ========== 新修改：练习选择界面（包含500ms无效区间） ==========
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='font-size: 48px; text-align: center;'>
          <p>どちらに賭けますか？</p>
          <p style='font-size: 28px; margin-top: 40px;'>U=上，N=下</p>
          <div id='practice-choice-hint' style='display:none; font-size: 22px; margin-top: 24px; color: #ffd966;'>今、選択してください。</div>
        </div>
      `,
      choices: "NO_KEYS", // 初始设置为不接受按键
      trial_duration: 3000, // 总时长3秒
      response_ends_trial: false, // 修改：不自动结束试次
      css_classes: ['jspsych-content'],
      on_load: function() {
        // 记录试次开始时间
        this.startTime = Date.now();
        this.validResponseReceived = false; // 标记是否收到有效响应
        
        // 添加自定义键盘监听器
        this.customKeyHandler = function(e) {
          const currentTime = Date.now() - this.startTime;
          
          if (currentTime < 500) {
            // 500ms内，忽略按键但不结束试次
            e.preventDefault();
            e.stopPropagation();
            return false;
          } else if (!this.validResponseReceived) {
            // 500ms后，处理有效按键
            const key = e.key.toUpperCase();
            if (['U', 'N'].includes(key)) {
              this.validResponseReceived = true;
              // 手动结束试次
              jsPsych.finishTrial({
                response: key,
                rt: currentTime
              });
            }
          }
        }.bind(this);
        
        document.addEventListener('keydown', this.customKeyHandler);
        
        // 500ms后显示提示
        setTimeout(() => {
          const hint = document.getElementById('practice-choice-hint');
          if (hint) hint.style.display = 'block';
        }, 500);
      },
      on_finish: function(data){
        // 处理响应与计分
        let key = data.response ? data.response : 0;
        let rt = 0;

        // 检查是否在500ms无效区间内按键
        if (typeof data.rt === 'number' && data.rt < 500) {
          // 在无效区间内的按键，忽略但不结束试次（此情形正常不应发生，因为试次不会因<500ms而结束）
          key = 0;
          rt = 0;
        } else if (typeof data.rt === 'number' && data.rt >= 500) {
          // 有效区间内的按键，记录完整反应时
          rt = data.rt;
        } else {
          // 未作答（超时）
          rt = 3000;
        }

        const correctKey = trial.Correct_Key;
        const isCorrect = (key != 0 && key.toUpperCase() === String(correctKey).toUpperCase());
        let scoreChange = 0;
        if (key == 0) {
          scoreChange = -10; // 超时：-10分
        } else if (isCorrect) {
          scoreChange = 10;
        } else {
          scoreChange = -10;
        }

        // 累加练习分数（包含超时）
        practiceScore += scoreChange;

        data.trial_type = "practice";
        data.trial_index = i+1;
        data.choice = key;
        data.rt = rt;
        data.isCorrect = isCorrect;
        data.scoreChange = scoreChange;
        data.practiceScore = practiceScore;

        // 清理事件监听器
        if (this.customKeyHandler) {
          document.removeEventListener('keydown', this.customKeyHandler);
        }
      },
      data: { is_practice: true }
    });
    // 画面5：フィードバック画面 (练习)
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='text-align: center;'>
          <img src='${IMAGE_PATH + trial.Correct_Image + ".png"}' style='height: 120px; margin-bottom: 40px;'>
          <div style='font-size: 32px; color: white; margin-top: 40px;'>+10pt</div>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: 800,
      css_classes: ['jspsych-content'],
      data: { is_practice: true } // 标记为练习试次
    });
    // 画面6：点数画面 (练习)
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function() {
      return`
        <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center;'>
          <div style='font-size: 48px;'>あなた</div>
          <div style='height: 100px;'></div>
          <div style='font-size: 48px;'>${practiceScore}</div> <!-- 修改：显示练习分数 -->
        </div>
      `;
    },
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
    data: { is_practice: true } // 标记为练习试次
    });
  }

  // === 在这里插入练习结束语界面 ===
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>練習が終了しました。スペースキーを押して正式実験に進んでください。</p>
        <!-- 这里可以后续自由编辑内容 -->
      </div>
    `,
    choices: [' '],
    css_classes: ['jspsych-content'],
  });

  // === 下面是准备画面 ===
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>これからゲームを始めます！</p>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: 2000,
    css_classes: ['jspsych-content'],
  });

  // ========== 画面1：支持语 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <!-- ルール説明 -->
        <p>当たれば+10pt、外れれば－10pt、3秒以内に賭けなければ-10pt</p>　
        <p style='font-size: 20px; margin-top: 40px;'>スペースキーを押してゲームを始めます。</p>
      </div>
      `,
    choices: [' '],
    css_classes: ['jspsych-content'],
  });

  // ========== 新增：建议界面（无限时，空格继续） ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>ここに「提案／アドバイス」用のテキストを表示します（後で確定）。</p>
        <p style='font-size: 20px; margin-top: 40px;'>スペースキーで次へ進みます。</p>
      </div>
    `,
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
  });

  // ========== 画面2：初期点数 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center;'>
        <div style='font-size: 48px;'>あなた</div>
         <div style='height: 400px;'></div> <!-- 間隔 -->
        <div style='font-size: 48px;'>0</div>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
  });

  // ========== 画面4：主体実験の流れ ==========
  for (let i = 0; i < 5; i++) {          //修改試行数
    const trial = trials[i % trials.length];
    // ====== 被験者試行 ======
    // 画面3：刺激画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='position: relative; width: 100vw; height: 100vh;'>
          <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
            <svg width='120' height='120'>
              <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
              <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
            </svg>
          </div>
          <img src='${IMAGE_PATH + trial.Up_Image + ".png"}' style='position: absolute; left: 50%; top: 20%; transform: translate(-50%, 0); height: 120px;'>
          <img src='${IMAGE_PATH + trial.Down_Image + ".png"}' style='position: absolute; left: 50%; bottom: 20%; transform: translate(-50%, 0); height: 120px;'>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: Math.floor(Math.random() * 151) + 1000,
      css_classes: ['jspsych-content'],
    });
    // ========== 新修改：正式实验选择界面（包含500ms无效区间） ==========
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='font-size: 48px; text-align: center;'>
          <p>どちらに賭けますか？</p>
          <p style='font-size: 28px; margin-top: 40px;'>U=上，N=下</p>
          <div id='choice-hint' style='display:none; font-size: 22px; margin-top: 24px; color: #ffd966;'>今、選択してください。</div>
        </div>
      `,
      choices: "NO_KEYS", // 初始设置为不接受按键
      trial_duration: 3000, // 总时长3秒
      response_ends_trial: false, // 修改：不自动结束试次
      css_classes: ['jspsych-content'],
      on_load: function() {
        // 记录试次开始时间
        this.startTime = Date.now();
        this.validResponseReceived = false; // 标记是否收到有效响应
        
        // 添加自定义键盘监听器
        this.customKeyHandler = function(e) {
          const currentTime = Date.now() - this.startTime;
          
          if (currentTime < 500) {
            // 500ms内，忽略按键但不结束试次
            e.preventDefault();
            e.stopPropagation();
            return false;
          } else if (!this.validResponseReceived) {
            // 500ms后，处理有效按键
            const key = e.key.toUpperCase();
            if (['U', 'N'].includes(key)) {
              this.validResponseReceived = true;
              // 手动结束试次
              jsPsych.finishTrial({
                response: key,
                rt: currentTime
              });
            }
          }
        }.bind(this);
        
        document.addEventListener('keydown', this.customKeyHandler);
        
        // 500ms后显示提示
        setTimeout(() => {
          const hint = document.getElementById('choice-hint');
          if (hint) hint.style.display = 'block';
        }, 500);
      },
      on_finish: function(data){
        let key = data.response ? data.response : 0;
        let rt = 0;
        
        // 检查是否在500ms无效区间内按键
        if (typeof data.rt === 'number' && data.rt < 500) {
          // 在无效区间内的按键，完全忽略，当作未作答
          key = 0;
          rt = 3000; // 超时
        } else if (typeof data.rt === 'number' && data.rt >= 500) {
          // 有效区间内的按键，记录完整反应时
          rt = data.rt;
        } else {
          // 未作答
          rt = 3000;
        }
        
        let chosenImage = null;
        if (key === 0) {
          chosenImage = null; // 未作答
        } else if (key.toUpperCase() === 'U') {
          chosenImage = trial.Up_Image;
        } else if (key.toUpperCase() === 'N') {
          chosenImage = trial.Down_Image;
        }
        // 判断是否正确
        let isCorrect = (chosenImage !== null && chosenImage === trial.Correct_Image);
        let scoreChange = 0;
        if (key == 0) {
          scoreChange = -10; // 修改：超时或无效选择都-10分
        } else if (isCorrect) {
          scoreChange = 10;
        } else {
          scoreChange = -10;
        }
        // 总分应包含超时与错误的扣分
        totalScore += scoreChange;

        // === 随机化参数 ===
        // Up_Image: 刺激界面上方图片
        // Down_Image: 刺激界面下方图片
        // Correct_Image: 反馈界面正确线索图片
        // chosenImage: 被试实际选择的图片（与刺激界面位置对应）
        // ================

        data.trial_type = "participant";
        data.trial_index = i+1;
        data.choice = key;
        data.chosenImage = chosenImage; // 记录被试实际选的图片
        data.rt = rt;
        data.isCorrect = isCorrect;
        data.scoreChange = scoreChange;
        data.totalScore = totalScore;
        data.opponentScore = trial.Fake_Score;

        // === 随机化参数 ===
        data.Up_Image = trial.Up_Image;           // 刺激界面上方图片
        data.Down_Image = trial.Down_Image;       // 刺激界面下方图片
        data.Correct_Image = trial.Correct_Image; // 反馈界面正确线索图片
        // =================

        // 清理事件监听器
        if (this.customKeyHandler) {
          document.removeEventListener('keydown', this.customKeyHandler);
        }
      }
    });
    // 画面5：フィードバック画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='text-align: center;'>
          <img src='${IMAGE_PATH + trial.Correct_Image + ".png"}' style='height: 120px; margin-bottom: 40px;'>
          <div style='font-size: 32px; color: white; margin-top: 40px;'>+10pt</div>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: 800,
      css_classes: ['jspsych-content'],
    });
    // 画面6：点数画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function() {
      return`
        <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center;'>
          <div style='font-size: 48px;'>あなた</div>
          <div style='height: 100px;'></div>
          <div style='font-size: 48px;'>${totalScore}</div>
        </div>
      `;
    },
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
    });
  }

  // ========== 画面7：終了語 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function() {
    return`
      <div style='font-size: 28px; text-align: center;'>
        <p>お疲れ様でした！スペースキーを押して終了します。</p>
        <p style='font-size: 24px; margin-top: 40px;'>Total Score：${totalScore}pt</p>
      </div>
    `;
    },
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
  });
  // ========== 画面8：感谢画面 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>ご参加いただきありがとうございました！スペースキーを押して報酬の決済に進んでください。</p>
      </div>
    `,
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
    on_finish: function() {
      // 未检测到作弊时才下载数据并重定向
      if (!cheatDetected) {
        // 显示下载提示和按钮
        const downloadMessage = document.createElement('div');
        downloadMessage.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.9); color: white; padding: 30px;
          border-radius: 15px; font-size: 18px; z-index: 10000;
          text-align: center; border: 2px solid #333;
          min-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const downloadButton = document.createElement('button');
        downloadButton.style.cssText = `
          background: #4CAF50; color: white; border: none; padding: 12px 24px;
          font-size: 16px; border-radius: 6px; cursor: pointer; margin: 15px 5px;
          transition: background 0.3s;
        `;
        downloadButton.textContent = '下载实验数据';
        
        const skipButton = document.createElement('button');
        skipButton.style.cssText = `
          background: #666; color: white; border: none; padding: 12px 24px;
          font-size: 16px; border-radius: 6px; cursor: pointer; margin: 15px 5px;
          transition: background 0.3s;
        `;
        skipButton.textContent = '跳过下载';
        
        downloadMessage.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #4CAF50;">实验完成！</h3>
            <p style="margin: 0; color: #ccc;">请点击下方按钮下载您的实验数据</p>
          </div>
        `;
        
        downloadMessage.appendChild(downloadButton);
        downloadMessage.appendChild(skipButton);
        document.body.appendChild(downloadMessage);
        
        // 下载按钮事件
        downloadButton.addEventListener('click', function() {
          downloadButton.textContent = '正在下载...';
          downloadButton.disabled = true;
          downloadButton.style.background = '#666';
          
          // 显示下载进度
          const progressDiv = document.createElement('div');
          progressDiv.style.cssText = 'margin-top: 15px; font-size: 14px; color: #ccc;';
          progressDiv.innerHTML = '正在准备数据...';
          downloadMessage.appendChild(progressDiv);
          
          try {
            // 获取实验数据
            const allData = jsPsych.data.get();
            progressDiv.innerHTML = '正在处理数据...';
            
            // 过滤正式实验数据
            const formalData = allData.filter(trial => !trial.is_practice);
            progressDiv.innerHTML = `找到 ${formalData.length} 条实验数据，正在生成CSV...`;
            
            // 转换为CSV
            const csvContent = convertToCSV(formalData);
            progressDiv.innerHTML = '正在下载文件...';
            
            // 执行下载
            const downloadSuccess = downloadCSV(csvContent, OUTPUT_XLSX_NAME);
            
            if (downloadSuccess) {
              progressDiv.innerHTML = '下载成功！';
              progressDiv.style.color = '#4CAF50';
              
              setTimeout(() => {
                downloadMessage.innerHTML = `
                  <div style="text-align: center; color: #4CAF50;">
                    <h3>✓ 下载完成！</h3>
                    <p>文件已保存到您的下载文件夹</p>
                    <p style="font-size: 14px; color: #ccc; margin-top: 10px;">即将跳转到完成页面...</p>
                  </div>
                `;
                setTimeout(() => {
                  window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
                }, 2000);
              }, 1000);
            } else {
              throw new Error('下载函数返回失败');
            }
            
          } catch (error) {
            console.error('下载过程中出错:', error);
            progressDiv.innerHTML = '下载失败';
            progressDiv.style.color = '#ff6b6b';
            
            // 显示详细错误信息
            const errorDetails = document.createElement('div');
            errorDetails.style.cssText = 'margin-top: 10px; font-size: 12px; color: #ff6b6b; background: rgba(255,107,107,0.1); padding: 10px; border-radius: 5px;';
            errorDetails.innerHTML = `
              <strong>错误详情：</strong><br>
              ${error.message || '未知错误'}<br><br>
              <strong>解决方案：</strong><br>
              1. 检查浏览器是否允许下载文件<br>
              2. 尝试关闭弹窗阻止程序<br>
              3. 检查下载文件夹权限<br>
              4. 如果问题持续，请联系实验管理员
            `;
            downloadMessage.appendChild(errorDetails);
            
            // 添加重试按钮
            const retryButton = document.createElement('button');
            retryButton.textContent = '重试下载';
            retryButton.style.cssText = `
              background: #ff6b6b; color: white; border: none; padding: 8px 16px;
              font-size: 14px; border-radius: 4px; cursor: pointer; margin: 10px 5px;
            `;
            retryButton.addEventListener('click', () => {
              downloadMessage.innerHTML = `
                <div style="margin-bottom: 20px;">
                  <h3 style="margin: 0 0 10px 0; color: #4CAF50;">实验完成！</h3>
                  <p style="margin: 0; color: #ccc;">请点击下方按钮下载您的实验数据</p>
                </div>
              `;
              downloadMessage.appendChild(downloadButton);
              downloadMessage.appendChild(skipButton);
            });
            downloadMessage.appendChild(retryButton);
            
            // 添加跳过按钮
            const skipButton2 = document.createElement('button');
            skipButton2.textContent = '跳过下载';
            skipButton2.style.cssText = `
              background: #666; color: white; border: none; padding: 8px 16px;
              font-size: 14px; border-radius: 4px; cursor: pointer; margin: 10px 5px;
            `;
            skipButton2.addEventListener('click', () => {
              window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
            });
            downloadMessage.appendChild(skipButton2);
          }
        });
        
        // 跳过按钮事件
        skipButton.addEventListener('click', function() {
          window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
        });
        
        // 按钮悬停效果
        downloadButton.addEventListener('mouseenter', () => downloadButton.style.background = '#45a049');
        downloadButton.addEventListener('mouseleave', () => downloadButton.style.background = '#4CAF50');
        skipButton.addEventListener('mouseenter', () => skipButton.style.background = '#555');
        skipButton.addEventListener('mouseleave', () => skipButton.style.background = '#666');
      }
    }
  });

  // ========== 実験開始 ==========
  jsPsych.run(timeline);
}
