// ========== 获取Prolific PID ==========
function getProlificPID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('PROLIFIC_PID') || 'NO_PID';
}
const prolificPID = getProlificPID();
// Debug 开关：URL 加 ?debug=1 时启用
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';
// 模拟上传失败开关：URL 加 ?simulate_upload_fail=1 时启用
const SIMULATE_UPLOAD_FAIL = new URLSearchParams(window.location.search).get('simulate_upload_fail') === '1';
if (DEBUG_MODE) {
  console.warn('[DEBUG] 调试模式已启用：反作弊将被禁用，错误将显示在页面覆盖层');
}
if (SIMULATE_UPLOAD_FAIL) {
  console.warn('[DEBUG] 模拟上传失败模式已启用：将强制触发上传失败以测试本地下载功能');
}

// ========== 调试控制面板 ==========
if (DEBUG_MODE || SIMULATE_UPLOAD_FAIL) {
  // 创建调试控制面板
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debug-panel';
  debugPanel.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 10000;
    background: rgba(0,0,0,0.8); color: white; padding: 15px;
    border-radius: 8px; font-family: monospace; font-size: 12px;
    border: 2px solid #333; min-width: 200px;
  `;
  
  debugPanel.innerHTML = `
    <div style="margin-bottom: 10px; font-weight: bold; color: #4CAF50;">调试控制面板</div>
    <button id="trigger-upload-fail" style="
      background: #ff6b6b; color: white; border: none; padding: 8px 12px;
      border-radius: 4px; cursor: pointer; margin: 2px; font-size: 11px;
    ">模拟上传失败</button>
    <button id="test-download" style="
      background: #4CAF50; color: white; border: none; padding: 8px 12px;
      border-radius: 4px; cursor: pointer; margin: 2px; font-size: 11px;
    ">测试本地下载</button>
    <div style="margin-top: 10px; font-size: 10px; color: #ccc;">
      状态: <span id="debug-status">就绪</span>
    </div>
  `;
  
  document.body.appendChild(debugPanel);
  
  // 添加事件监听器
  document.getElementById('trigger-upload-fail').addEventListener('click', function() {
    document.getElementById('debug-status').textContent = '已触发上传失败';
    document.getElementById('debug-status').style.color = '#ff6b6b';
    // 这里可以触发一个全局标志，让上传函数检测到并失败
    window.DEBUG_FORCE_UPLOAD_FAIL = true;
  });
  
  document.getElementById('test-download').addEventListener('click', function() {
    document.getElementById('debug-status').textContent = '正在测试下载...';
    document.getElementById('debug-status').style.color = '#ffa500';
    try {
      downloadExperimentData();
      document.getElementById('debug-status').textContent = '下载测试成功';
      document.getElementById('debug-status').style.color = '#4CAF50';
    } catch (error) {
      document.getElementById('debug-status').textContent = '下载测试失败: ' + error.message;
      document.getElementById('debug-status').style.color = '#ff6b6b';
    }
  });
}
console.log('Prolific ID:', prolificPID);

const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=CZEQN2PE"; // Completion Code

// ========== 数据上传服务器設定 ==========
// 参照single.js的服务器路径设置
const FILE_UPLOAD_URL = 'https://www.psycho.hes.kyushu-u.ac.jp/~baichibon/ai/save_data.php';

// ========== 1. パス設定 ==========
const IMAGE_PATH = "formalimages/"; // images folder
const TRIALS_XLSX_PATH = "experiment_data/formal_trials.csv"; // pseudorandom 試行表（順、手がかりの図、桜について）
const OUTPUT_XLSX_NAME = "ai_choice_data.csv"; // AI条件数据输出
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

// ========== 调试：错误覆盖层 ==========
function ensureErrorOverlay() {
  let overlay = document.getElementById('error-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'error-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);color:#ff6b6b;z-index:2147483647;padding:20px;overflow:auto;display:none;font-family:monospace;';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showError(message, detail) {
  if (!DEBUG_MODE) return;
  const overlay = ensureErrorOverlay();
  overlay.style.display = 'block';
  const now = new Date().toLocaleTimeString();
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordBreak = 'break-word';
  pre.textContent = `[${now}] ${message}\n${detail || ''}`;
  overlay.appendChild(pre);
}

window.addEventListener('error', function(e){
  showError('Uncaught Error: ' + (e.message || ''), (e.filename||'') + ':' + (e.lineno||'') + ':' + (e.colno||''));
});
window.addEventListener('unhandledrejection', function(e){
  const reason = e.reason && (e.reason.stack || e.reason.message) ? (e.reason.stack || e.reason.message) : String(e.reason);
  showError('Unhandled Promise Rejection', reason);
});

// ========== 防作弊机制 ==========
let cheatDetected = false;
let cheatInfo = {
  isCheat: 1, // 1为未作弊，2为作弊
  cheatTrial: null, // 作弊发生的试次号
  cheatMethod: null // 作弊方式
};

// ========== 本地下载CSV数据函数（用于上传失败时的备用方案） ==========
function downloadExperimentData() {
  console.log('开始下载实验数据...');
  
  try {
    // 获取所有实验数据
    const allData = jsPsych.data.get().values();
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
      const allData = jsPsych.data.get().values();
      const csvContent = convertToCSV(allData);
      downloadCSV(csvContent, 'backup_' + OUTPUT_XLSX_NAME);
    } catch (backupError) {
      console.error('备用下载方法也失败了:', backupError);
      alert('数据下载失败，请检查浏览器控制台获取详细信息');
    }
  }
}

// ========== CSV下载辅助函数（用于上传失败时的备用方案） ==========
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
  if (!Array.isArray(data) || data.length === 0) return '';

  // 过滤掉 null/undefined/空对象 的记录，但保留问卷数据
  const sanitized = data.filter(row => row && typeof row === 'object' && Object.keys(row).length > 0);
  if (sanitized.length === 0) return '';

  // 为每条记录添加作弊信息和实验条件
  const enhancedData = sanitized.map(row => {
    const enhanced = {
      ...row,
      isCheat: cheatInfo.isCheat,
      cheatTrial: cheatInfo.cheatTrial,
      cheatMethod: cheatInfo.cheatMethod,
      experimentCondition: 'AI'
    };
    
    // 如果是Likert问卷数据，添加特殊标记
    if (row.trial_type === 'survey-likert') {
      enhanced.survey_type = 'ai_advice_trust_rating';
      enhanced.survey_question = '上述AI建议的可信度评价';
      enhanced.survey_response = row.response ? row.response.Q0 : null;
      enhanced.survey_scale = '7-point Likert (1=完全不可信, 7=完全可信)';
    }
    
    return enhanced;
  });

  // 合并所有字段，得到完整列集合（避免仅以第一行作为列头导致字段缺失）
  const headerSet = new Set();
  enhancedData.forEach(row => {
    Object.keys(row).forEach(k => headerSet.add(k));
  });
  const headers = Array.from(headerSet);

  // 生成CSV头
  const csvHeader = headers.join(',');

  // 生成CSV行
  const csvRows = enhancedData.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  return [csvHeader, ...csvRows].join('\n');
}


// ========== 新增：sakura服务器数据上传功能 ==========
function uploadExperimentDataToServer() {
  console.log('开始上传实验数据到sakura服务器...');
  
  try {
    // 获取所有实验数据
    const allData = jsPsych.data.get().values();
    console.log('获取到所有数据，共', allData.length, '条记录');
    
    // 过滤掉练习数据，保留正式实验数据和问卷数据
    const formalData = allData.filter(trial => 
      !trial.is_practice || 
      trial.trial_type === 'survey-likert' || 
      trial.trial_type === 'survey-text' || 
      trial.trial_type === 'survey-multi-choice' || 
      trial.trial_type === 'survey-multi-select'
    );
    console.log('过滤后的正式实验数据和问卷数据，共', formalData.length, '条记录');
    
    // 检查是否包含问卷数据
    const likertData = formalData.filter(trial => trial.trial_type === 'survey-likert');
    console.log('包含Likert问卷数据，共', likertData.length, '条记录');
    
    if (formalData.length === 0) {
      console.warn('没有找到正式实验数据，上传所有数据');
      // 如果没有正式数据，上传所有数据
      return uploadDataToServer(allData, 'all_experiment_data');
    }
    
    // 上传正式实验数据和问卷数据
    return uploadDataToServer(formalData, 'formal_experiment_data_with_survey');
    
  } catch (error) {
    console.error('上传实验数据时出错:', error);
    return Promise.reject(error);
  }
}

// ========== 修改：数据上传到 sakura 的 PHP，由其写入外部 MySQL ==========
function uploadDataToServer(data, dataType) {
  return new Promise((resolve, reject) => {
    try {
      // 模拟上传失败（用于测试本地下载功能）
      if (SIMULATE_UPLOAD_FAIL || window.DEBUG_FORCE_UPLOAD_FAIL) {
        console.warn('[DEBUG] 模拟上传失败：将触发上传失败以测试本地下载功能');
        setTimeout(() => {
          reject(new Error('模拟上传失败：网络连接超时'));
        }, 2000); // 2秒后模拟失败
        return;
      }
      // 为每条数据添加作弊信息和实验条件
      const enhancedData = data.map(row => {
        return {
          ...row,
          isCheat: cheatInfo.isCheat,
          cheatTrial: cheatInfo.cheatTrial,
          cheatMethod: cheatInfo.cheatMethod,
          experimentCondition: 'AI'
        };
      });
      
      // 准备表单数据，便于 PHP 使用 $_POST 读取并写入外部 MySQL
      const form = new URLSearchParams();
      form.set('prolific_pid', prolificPID);
      form.set('experiment_start', experimentStartTime);
      form.set('data_type', dataType);
      form.set('experiment_data', JSON.stringify(enhancedData));
      form.set('timestamp', new Date().toISOString());
      form.set('user_agent', navigator.userAgent);
      form.set('total_trials', String(enhancedData.length));
      form.set('experiment_version', 'study2_ai_condition');
      form.set('browser_language', navigator.language || '');
      form.set('browser_platform', navigator.platform || '');
      form.set('suggested_file_name', `ai_${prolificPID || 'NO_PID'}_${Date.now()}.json`);
      
      // 添加作弊信息到表单
      form.set('is_cheat', String(cheatInfo.isCheat));
      form.set('cheat_trial', String(cheatInfo.cheatTrial || ''));
      form.set('cheat_method', String(cheatInfo.cheatMethod || ''));
      
      // 添加实验条件标识
      form.set('experiment_condition', 'AI');

      console.log('准备上传数据到:', FILE_UPLOAD_URL);
      console.log('数据条数:', enhancedData.length);
      console.log('作弊信息:', cheatInfo);

      // 发送到 save_data.php，由其负责将数据写入外部 MySQL
      fetch(FILE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: form.toString()
      })
      .then(response => {
        console.log('服务器响应状态:', response.status);
        
        if (!response.ok) {
          throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
        }
        // 优先尝试解析 JSON，其次回退到纯文本
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) return response.json();
        return response.text();
      })
      .then(result => {
        console.log('数据上传成功:', result);
        // 兼容两种返回：JSON 或 纯文本
        if (typeof result === 'object' && result) {
          if (result.success) return resolve(result);
          if (typeof result.message === 'string' && /success|成功/i.test(result.message)) {
            return resolve({ success: true, message: result.message });
          }
          throw new Error('服务器返回JSON但未包含成功标记');
        }
        if (typeof result === 'string' && /success|成功/i.test(result)) {
          return resolve({ success: true, message: result });
        }
        throw new Error('PHP处理失败: ' + String(result));
      })
      .catch(error => {
        console.error('数据上传失败:', error);
        reject(error);
      });
      
    } catch (error) {
      console.error('准备上传数据时出错:', error);
      reject(error);
    }
  });
}

function abortExperimentDueToCheat(reason, currentTrialIndex = null) {
  if (cheatDetected) return;
  cheatDetected = true;
  
  // 更新作弊信息
  cheatInfo.isCheat = 2; // 2表示作弊
  cheatInfo.cheatTrial = currentTrialIndex || (jsPsych.data.get().values().length + 1);
  cheatInfo.cheatMethod = reason;
  
  try {
    jsPsych.data.addProperties({ 
      cheatDetected: true, 
      cheatReason: reason,
      isCheat: cheatInfo.isCheat,
      cheatTrial: cheatInfo.cheatTrial,
      cheatMethod: cheatInfo.cheatMethod
    });
  } catch (_) {}
  
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

// 键盘组合检测：F12、Ctrl+U、Ctrl+Shift+I/J/C（调试模式禁用）
if (!DEBUG_MODE) {
  window.addEventListener('keydown', function(e) {
    const key = (e.key || '').toUpperCase();
    if (key === 'F12' || (e.ctrlKey && !e.shiftKey && key === 'U') || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(key))) {
      e.preventDefault();
      const currentTrialIndex = jsPsych.data.get().values().filter(trial => trial.trial_type === 'participant').length + 1;
      abortExperimentDueToCheat(`key:${key}`, currentTrialIndex);
    }
  }, true);
} else {
  console.warn('[DEBUG] 键盘反作弊检测已禁用');
}

// 简易DevTools开启检测（尺寸差异法）（调试模式禁用）
if (!DEBUG_MODE) {
  let lastDevtoolsState = false;
  setInterval(() => {
    if (cheatDetected) return;
    const threshold = 160;
    const devtoolsLike = Math.abs(window.outerWidth - window.innerWidth) > threshold || Math.abs(window.outerHeight - window.innerHeight) > threshold;
    if (devtoolsLike && !lastDevtoolsState) {
      lastDevtoolsState = true;
      const currentTrialIndex = jsPsych.data.get().values().filter(trial => trial.trial_type === 'participant').length + 1;
      abortExperimentDueToCheat('devtools_open', currentTrialIndex);
    }
  }, 1000);
} else {
  console.warn('[DEBUG] DevTools 检测已禁用');
}

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
    console.log('Loaded practice trials data:', practiceTrials.length, 'trials');
    
    // 检查练习数据完整性
    if (!practiceTrials || practiceTrials.length === 0) {
      console.error('No practice trials data loaded');
      showError('练习数据加载失败', '无法加载练习数据，请检查网络连接');
      return;
    }
    Papa.parse(TRIALS_XLSX_PATH, {
      download: true,
      header: true,
      complete: function(results) {
        trials = results.data;
        console.log('Loaded trials data:', trials.length, 'trials');
        
        // 检查数据完整性
        if (!trials || trials.length === 0) {
          console.error('No trials data loaded');
          showError('数据加载失败', '无法加载实验数据，请检查网络连接');
          return;
        }
        
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
          // 正确线索图片分配：
          // 第1块（前30试次）：'1'中奖21次，'2'中奖9次
          // 之后每块（每30试次）：'1'中奖12次，'2'中奖18次
          let correctImages;
          if (block === 0) {
            correctImages = Array(21).fill('1').concat(Array(9).fill('2'));
          } else {
            correctImages = Array(9).fill('1').concat(Array(21).fill('2'));
          }
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

// 将startExperiment函数定义移到调用之前
function startExperiment() {
  // 在组装并运行时间线前，确保 jsPsych 核心与所需插件已就绪
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function ensureJsPsychReady() {
    const tasks = [];
    if (typeof window.initJsPsych === 'undefined') {
      tasks.push(loadScript('https://unpkg.com/jspsych@7.3.3/dist/jspsych.js'));
    }
    return Promise.all(tasks).then(() => {
      if (typeof window.jsPsychHtmlKeyboardResponse === 'undefined') {
        return loadScript('https://unpkg.com/jspsych@7.3.3/dist/plugin-html-keyboard-response.js');
      }
    });
  }

  // 若插件尚未可用，则先加载再重入本函数
  if (typeof window.jsPsychHtmlKeyboardResponse === 'undefined') {
    ensureJsPsychReady()
      .then(() => {
        if (typeof window.jsPsychHtmlKeyboardResponse === 'undefined') {
          showError('jsPsych 插件仍不可用', 'jsPsychHtmlKeyboardResponse 未加载');
          return;
        }
        startExperiment();
      })
      .catch(err => {
        showError('加载 jsPsych 依赖失败', err && err.message ? err.message : String(err));
      });
    return;
  }

  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <p>こちらは練習のセクションです。（练习环节）</p>
        <p>練習に入る前に、必ず本研究のProlificページに記載された説明をよくお読みください。（不重要）</p>
        <p>このセクションを通じて、実験の流れに慣れてください。（流程为提示线索图片的位置，做出选择，提示中奖的图片，提示当前得分）</p>
        <p>スペースキーを押して練習を開始してください。（按空格开始练习）</p>
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
              <div style='font-size: 24px; color: white;'>图片1 要素集中型线索（简称集中型）</div>
            </div>
            <div>
              <img src='${IMAGE_PATH}2.png' style='height: 120px; margin-bottom: 20px;'>
              <div style='font-size: 24px; color: white;'>图片2 要素分散型线索（简称分散型）</div>
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
    
    // 安全检查：确保练习试次数据完整
    if (!trial || !trial.Up_Image || !trial.Down_Image || !trial.Correct_Image) {
      console.error('Practice trial data is incomplete:', trial);
      continue; // 跳过这个试次
    }
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
          <p>どちらに賭けますか？（你打算选哪个？）</p>
          <p style='font-size: 28px; margin-top: 40px;'>U=上，N=下</p>
          <div id='practice-choice-hint' style='display:none; font-size: 22px; margin-top: 24px; color: #ffd966;'>今、選択してください。（现在请你做出选择）</div>
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
        
        // === 作弊信息 ===
        data.isCheat = cheatInfo.isCheat;
        data.cheatTrial = cheatInfo.cheatTrial;
        data.cheatMethod = cheatInfo.cheatMethod;
        // ===============

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
        <p>練習が終了しました。スペースキーを押して正式実験に進んでください。（练习结束，按空格开始正式实验）</p>
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
        <p>来自学习过上次游戏的结果数据的AI的建议：建议选择集中型线索。根据上次实验的数据，集中型中奖的概率远高于分散型。下列日语，大家根据汉字部分可以大体明白内容。大致列举出具体数据告知给为集中型线索中奖的概率远高于分散型。</p>
        <p>理由：選択肢1（集中型）が全体で10500回勝っているのに対し、選択肢2（分散型）は4500回しか勝っていないため、選択肢1が正しい選択肢となる確率が高いことがわかります。
さらに、選択肢1が上部に表示された場合は、5258回勝つことが多く、選択肢1が下部に表示された場合は、5242回勝っていることから、選択肢1は上部に表示された際に特に有利だと考えられます。一方で、選択肢2は上部に表示された場合は2242回、下部に表示された場合は2258回しか勝っていません。したがって、選択肢1を選ぶことが最も有利であると考えます。</p>
        <p style='font-size: 20px; margin-top: 40px;'>スペースキーで次へ進みます。（按空格开始实验）</p>
      </div>
    `,
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
  });

  // ========== 新增：AI建议可信度评分（使用jsPsychSurveyLikert） ==========
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">上述AI建议的可信度をどの程度評価しますか？（您对上述AI建议的可信度如何评价？）</div>',
        labels: ['<span class="white">完全不可信</span>', '<span class="white">不同意</span>', '<span class="white">有点不同意</span>', '<span class="white">中立</span>', '<span class="white">有点同意</span>', '<span class="white">同意</span>', '<span class="white">完全可信</span>'],
        required: true
      }
    ]
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
    
    // 安全检查：确保trial对象和必要属性存在
    if (!trial || !trial.Up_Image || !trial.Down_Image || !trial.Correct_Image) {
      console.error('Trial data is incomplete:', trial);
      continue; // 跳过这个试次
    }
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

        // === 随机化参数 ===
        data.Up_Image = trial.Up_Image;           // 刺激界面上方图片
        data.Down_Image = trial.Down_Image;       // 刺激界面下方图片
        data.Correct_Image = trial.Correct_Image; // 反馈界面正确线索图片
        // =================
        
        // === 作弊信息 ===
        data.isCheat = cheatInfo.isCheat;
        data.cheatTrial = cheatInfo.cheatTrial;
        data.cheatMethod = cheatInfo.cheatMethod;
        // ===============

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
        <p>お疲れ様でした！スペースキーを押して終了します。（按空格结束实验）</p>
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
        <p>ご参加いただきありがとうございました！スペースキーを押して報酬の決済に進んでください。（按空格开始报酬结算）</p>
      </div>
    `,
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
    on_finish: function() {
      // 未检测到作弊时才上传数据并重定向
      if (!cheatDetected) {
        // 显示上传提示和按钮
        const uploadMessage = document.createElement('div');
        uploadMessage.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.9); color: white; padding: 30px;
          border-radius: 15px; font-size: 18px; z-index: 10000;
          text-align: center; border: 2px solid #333;
          min-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const uploadButton = document.createElement('button');
        uploadButton.style.cssText = `
          background: #4CAF50; color: white; border: none; padding: 12px 24px;
          font-size: 16px; border-radius: 6px; cursor: pointer; margin: 15px 5px;
          transition: background 0.3s;
        `;
        uploadButton.textContent = '上传实验数据';
        
        const skipButton = document.createElement('button');
        skipButton.style.cssText = `
          background: #666; color: white; border: none; padding: 12px 24px;
          font-size: 16px; border-radius: 6px; cursor: pointer; margin: 15px 5px;
          transition: background 0.3s;
        `;
        skipButton.textContent = '跳过上传';
        
        uploadMessage.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #4CAF50;">实验完成！</h3>
            <p style="margin: 0; color: #ccc;">请点击下方按钮上传您的实验数据到服务器</p>
          </div>
        `;
        
        uploadMessage.appendChild(uploadButton);
        uploadMessage.appendChild(skipButton);
        document.body.appendChild(uploadMessage);
        
        // 上传按钮事件
        uploadButton.addEventListener('click', function() {
          uploadButton.textContent = '正在上传...';
          uploadButton.disabled = true;
          uploadButton.style.background = '#666';
          
          // 显示上传进度
          const progressDiv = document.createElement('div');
          progressDiv.style.cssText = 'margin-top: 15px; font-size: 14px; color: #ccc;';
          progressDiv.innerHTML = '正在准备数据...';
          uploadMessage.appendChild(progressDiv);
          
          // 执行数据上传
          uploadExperimentDataToServer()
            .then(result => {
              progressDiv.innerHTML = '数据上传成功！';
              progressDiv.style.color = '#4CAF50';
              
              setTimeout(() => {
                uploadMessage.innerHTML = `
                  <div style="text-align: center; color: #4CAF50;">
                    <h3>✓ 上传完成！</h3>
                    <p>数据已成功保存到服务器</p>
                    <p style="font-size: 14px; color: #ccc; margin-top: 10px;">即将跳转到完成页面...</p>
                  </div>
                `;
                setTimeout(() => {
                  window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
                }, 2000);
              }, 1000);
            })
            .catch(error => {
              console.error('上传过程中出错:', error);
              progressDiv.innerHTML = '上传失败，正在尝试本地下载...';
              progressDiv.style.color = '#ff6b6b';
              
              // 尝试本地下载
              try {
                downloadExperimentData();
                progressDiv.innerHTML = '上传失败，但数据已自动下载到本地';
                progressDiv.style.color = '#ffa500';
              } catch (downloadError) {
                console.error('本地下载也失败了:', downloadError);
                progressDiv.innerHTML = '上传和本地下载都失败了';
                progressDiv.style.color = '#ff6b6b';
              }
              
              // 显示详细错误信息
              const errorDetails = document.createElement('div');
              errorDetails.style.cssText = 'margin-top: 10px; font-size: 12px; color: #ff6b6b; background: rgba(255,107,107,0.1); padding: 10px; border-radius: 5px;';
              errorDetails.innerHTML = `
                <strong>错误详情：</strong><br>
                ${error.message || '未知错误'}<br><br>
                <strong>解决方案：</strong><br>
                1. 检查网络连接是否正常<br>
                2. 尝试刷新页面重新上传<br>
                3. 如果问题持续，请联系实验管理员<br>
                4. 数据已自动下载到本地，请发送给研究者<br>
                5. 您也可以选择跳过上传直接完成实验
              `;
              uploadMessage.appendChild(errorDetails);
              
              // 添加重试按钮
              const retryButton = document.createElement('button');
              retryButton.textContent = '重试上传';
              retryButton.style.cssText = `
                background: #ff6b6b; color: white; border: none; padding: 8px 16px;
                font-size: 14px; border-radius: 4px; cursor: pointer; margin: 10px 5px;
              `;
              retryButton.addEventListener('click', () => {
                uploadMessage.innerHTML = `
                  <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; color: #4CAF50;">实验完成！</h3>
                    <p style="margin: 0; color: #ccc;">请点击下方按钮上传您的实验数据到服务器</p>
                  </div>
                `;
                uploadMessage.appendChild(uploadButton);
                uploadMessage.appendChild(skipButton);
              });
              uploadMessage.appendChild(retryButton);
              
              // 添加跳过按钮
              const skipButton2 = document.createElement('button');
              skipButton2.textContent = '跳过上传';
              skipButton2.style.cssText = `
                background: #666; color: white; border: none; padding: 8px 16px;
                font-size: 14px; border-radius: 4px; cursor: pointer; margin: 10px 5px;
              `;
              skipButton2.addEventListener('click', () => {
                window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
              });
              uploadMessage.appendChild(skipButton2);
            });
        });
        
        // 跳过按钮事件
        skipButton.addEventListener('click', function() {
          window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
        });
        
        // 按钮悬停效果
        uploadButton.addEventListener('mouseenter', () => uploadButton.style.background = '#45a049');
        uploadButton.addEventListener('mouseleave', () => uploadButton.style.background = '#4CAF50');
        skipButton.addEventListener('mouseenter', () => skipButton.style.background = '#555');
        skipButton.addEventListener('mouseleave', () => skipButton.style.background = '#666');
      }
    }
  });

  // ========== 実験開始 ==========
  jsPsych.run(timeline);
}
