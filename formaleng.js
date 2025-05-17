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
        <p>1.Bet alternately.</p>　
        <p>2.If you hit, +10 points; if you miss, -10 points; if you don't bet within 3 seconds, ±0 points.</p>　  
        <p>3.Regardless of the point difference with others, the rewards obtained are received as they are.　</p>
        <p style='font-size: 20px; margin-top: 40px;'>Press the space key to start the game.</p>
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
        <div style='font-size: 48px;'>You</div>
         <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
        <div style='font-size: 48px;'>0</div>
      </div>
      <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
        <div style='font-size: 48px;'>Counterpart</div>
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
  for (let i = 0; i < 240; i++) {          //修改试次数量
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
            <p>It's your turn.</p>
            <p>Which side do you bet on?</p>
            <p style='font-size: 28px; margin-top: 40px;'>8=Up, 2=Down</p>
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
            <div style='font-size: 48px;'>You</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${totalScore}</div>
          </div>
          <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>Counterpart</div>
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
            <p>Counterpart is selecting. Please wait for a moment.</p>
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
            <div style='font-size: 48px;'>You</div>
            <div style='height: 400px;'></div> <!-- 增加间隔，可调整高度 -->
            <div style='font-size: 48px;'>${totalScore}</div>
          </div>
          <div style='position: absolute; right: 20vw; top: 20vh; text-align: center;'>
            <div style='font-size: 48px;'>Counterpart</div>
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
        <!--  -->
        <p>Thank you for your participation! Please press the space key to end the experiment.</p>
        <p style='font-size: 24px; margin-top: 40px;'>Total Score：${totalScore}pt</p>
      </div>
      `;
    },
    choices: "NO_KEYS",
    trial_duration: null,
    css_classes: ['jspsych-content'],
    });
  

  // ========== 启动实验 ==========
  jsPsych.run(timeline);
}