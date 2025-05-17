// ========== 获取Prolific PID ==========
function getProlificPID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('PROLIFIC_PID') || 'NO_PID';
}
const prolificPID = getProlificPID();

const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=C1M6ISR3"; // 替换为你的Completion Code

// ========== 1. 路径设置 ==========
const IMAGE_PATH = "formalimages/"; // 图片文件夹（如需更改请修改此处）
const TRIALS_XLSX_PATH = "experiment_data/formal_trials.csv"; // 试次表格（如需更改请修改此处）
const OUTPUT_XLSX_NAME = "formal_choice_data.xlsx"; // 输出文件名（如需更改请修改此处）

// ========== 2. jsPsych初始化与全局样式 ==========
const jsPsych = initJsPsych({
  on_finish: function() {
    jsPsych.data.get().localSave('xlsx', OUTPUT_XLSX_NAME);
  }
});
jsPsych.data.addProperties({prolificPID: prolificPID});

const globalStyle = `
  body { background-color: black !important; color: white !important; }
  .jspsych-content { color: white !important; }
`;
const style = document.createElement('style');
style.innerHTML = globalStyle;
document.head.appendChild(style);

// ========== 3. 读取试次表格 ==========
let trials = [];
let timeline = [];
let totalScore = 0;

Papa.parse(TRIALS_XLSX_PATH, {
  download: true,
  header: true,
  complete: function(results) {
    trials = results.data;
    startExperiment();
  }
});

function startExperiment() {
  let isParticipantTurn = true;
  let trialIndex = 0;
  // ========== 界面1：指导语 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <!-- ルール説明 -->
        <p>1.交互に賭けを行う</p>　
        <p>2.当たれば+10pt、外れれば－10pt、3秒以内に賭けなければ±0pt</p>　  
        <p>3.他者との点差に関係なく，獲得した 報酬がそのまま得られる　</p>
        <p style='font-size: 20px; margin-top: 40px;'>スペースキーに押してゲームを始めます。</p>
      </div>
      `,
    choices: [' '],
    css_classes: ['jspsych-content'],
  });

  // ========== 界面2：初始分数 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='position: absolute; left: 20vw; top: 20vh; text-align: center;'>
        <div style='font-size: 48px;'>あなた</div>
         <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
        <div style='font-size: 48px;'>0</div>
      </div>
      <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
        <div style='font-size: 48px;'>相手</div>
          <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
        <div style='font-size: 48px;'>0</div>
      </div>
      <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
        <svg width='100' height='100'>
         <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
         <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
       </svg>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
  });

  // ========== 4. 主体实验流程 ==========
  for (let i = 0; i < 4; i++) {          //修改试次数量
    const trial = trials[i % trials.length];
    if (isParticipantTurn) {
      // ====== 被试试次 ======
      // 界面3：刺激界面
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
      // 界面4：选择界面
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style='font-size: 48px; text-align: center;'>
            <!--  -->
            <p>あなたの番です。</p>
            <p>どちらに賭けますか？</p>
            <p style='font-size: 28px; margin-top: 40px;'>8=上，2=下</p>
          </div>
        `,
        choices: ['8', '2'],
        trial_duration: 3000,
        response_ends_trial: true,
        css_classes: ['jspsych-content'],
        on_finish: function(data){
          let key = data.response ? data.response : 0;
          let rt = data.rt ? data.rt : 3000;
          let correctKey = trial.Correct_Key;
          let isCorrect = (key == correctKey);
          let scoreChange = 0;
          if (key == 0) {
            scoreChange = 0;
          } else if (isCorrect) {
            scoreChange = 10;
          } else {
            scoreChange = -10;
          }
          if (key != 0) totalScore += scoreChange;
          data.trial_type = "participant";
          data.trial_index = i+1;
          data.choice = key;
          data.rt = rt;
          data.isCorrect = isCorrect;
          data.scoreChange = scoreChange;
          data.totalScore = totalScore;
          data.opponentScore = trial.Fake_Score;
        }
      });
      // 界面5：反馈界面
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
      // 界面6：分数界面
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function() {
        return`
          <div style='position: absolute; left: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>あなた</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${totalScore}</div>
          </div>
          <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>相手</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${trial.Fake_Score}</div>
          </div>
          <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
           <svg width='100' height='100'>
             <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
             <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
           </svg>
          </div>
        `;
      },
      choices: "NO_KEYS",
      trial_duration: 800,
      css_classes: ['jspsych-content'],
      });
    } else {
      // ====== 对手试次 ======
      // 界面7：对手刺激界面
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
      // 界面8：对手选择界面
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style='font-size: 48px; text-align: center;'>
            <!--  -->
            <p>相手が選択中です。しばらくお待ち下さい。</p>
          </div>
        `,
        choices: "NO_KEYS",
        trial_duration: Math.floor(Math.random() * 2001) + 1000,
        css_classes: ['jspsych-content'],
      });
      // 界面9：对手反馈界面
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style='text-align: center;'>
            <img src='${IMAGE_PATH + trial.Correct_Image + ".png"}' style='height: 120px; margin-bottom: 40px;'>
            <div style='font-size: 48px; color: white; margin-top: 40px;'>+10pt</div>
          </div>
        `,
        choices: "NO_KEYS",
        trial_duration: 800,
        css_classes: ['jspsych-content'],
      });
      // 界面10：对手分数界面
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function() {
        return`
          <div style='position: absolute; left: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>あなた</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${totalScore}</div>
          </div>
          <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>相手</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${trial.Fake_Score}</div> 
          </div>
          <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
           <svg width='100' height='100'>
             <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
             <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
           </svg>
          </div>
        `;
        },
        choices: "NO_KEYS",
        trial_duration: 800,
        css_classes: ['jspsych-content'],
      });
    }
    isParticipantTurn = !isParticipantTurn;
  }

  // ========== 界面11：结束语 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function() {
    return`
      <div style='font-size: 28px; text-align: center;'>
        <p>お疲れ様でした！スペースキーを押して自省報告に進んでください。</p>
        <p style='font-size: 24px; margin-top: 40px;'>Total Score：${totalScore}pt</p>
      </div>
    `;
    },
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
  });
  
  // ========== 问卷调查界面 ==========
  // 请确保在HTML中引入以下插件：
  // <script src="jspsych/dist/plugin-survey-likert.js"></script>
  // <script src="jspsych/dist/plugin-survey-multi-choice.js"></script>
  // <script src="jspsych/dist/plugin-survey-text.js"></script>

  // 问卷1：選択と報酬の関係
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">あなたは、画面に表示された「手がかり」と「報酬確率」の関係をどの程度理解していましたか？具体的に説明してください。</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 问卷2：選択の基準+戦略の自由記述
  timeline.push({
    type: jsPsychSurveyMultiSelect,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">あなたの選択は主にどの要因に基づいていましたか？（複数選択可）</div>',
<<<<<<< HEAD
        options: ['手がかりの視覚的特徴（色・形など）', '過去の報酬/損失のフィードバック', '直感やランダムな選択', '相手の選択結果', 'その他'],
=======
       // options: ['手がかりの視覚的特徴（色・形など）', '過去の報酬/損失のフィードバック', '直感やランダムな選択', '相手の選択結果', 'その他'],
        options: ['手がかりの視覚的特徴（色・形など）', '過去の報酬/損失のフィードバック', '直感やランダムな選択', 'その他'],
>>>>>>> c2bbfbbc457e4e7d143626d005b7d9073192b306
        required: false
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">タスク中の選択戦略を具体的に説明してください（例：「最初はランダムに選び、報酬が多い方を続けた」）。</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 问卷3：相手の影響
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">相手の選択結果は、あなたの次の選択にどの程度影響しましたか？</div>',
        labels: ['全く影響しなかった', '少し影響した', '中程度に影響した', '強く影響した', '非常に強く影響した'],
        required: true
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">相手がどのようなルールで選択していたと思いますか？</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 问卷4：フィードバックの影響
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">報酬や損失のフィードバックは、その後の選択にどの程度影響しましたか？</div>',
        labels: ['全く影響しなかった', '少し影響した', '中程度に影響した', '強く影響した', '非常に強く影響した'],
        required: true
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">タスク中に混乱した点や疑問に思った点はありますか？</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 问卷5：仅开放题
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">実験全体に関する自由な意見や提案があればご記入ください。</div>',
        rows: 6,
        columns: 60,
        required: false
      }
    ],
    on_finish: function() {
      window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
    }
  });


  // ========== 启动实验 ==========
  jsPsych.run(timeline);
}
